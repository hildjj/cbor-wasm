#include "library.h"

#pragma GCC diagnostic ignored "-Wgnu-label-as-value"
#pragma GCC diagnostic ignored "-Wgnu-designator"

#define DMAX_DEPTH 20
#define DFAIL -128

const int FAIL = DFAIL;
const int MAX_DEPTH = DMAX_DEPTH;

#define ERROR() { frame->val = __LINE__; goto l_ebad; }
#define DEEPER() { if (++parser->depth >= DMAX_DEPTH) ERROR() }
#define min(a, b) (((a)<(b))?(a):(b))

// Two interoperable enums; States overlaps MT except for FAIL.
#define FOREACH_MT(FN) \
  FN(POS), \
  FN(NEG), \
  FN(BYTES), \
  FN(UTF8), \
  FN(ARRAY), \
  FN(MAP), \
  FN(TAG), \
  FN(SIMPLE)

#define FOREACH_STATE(FN) \
  FN(START), \
  FN(COUNT), \
  FN(CHUNKS), \
  FN(END), \
  FN(END_EMPTY)

#define GEN_ENUM(ENUM) ENUM
#define GEN_ENUM_MT(ENUM) MT_##ENUM
#define GEN_STR(STR) #STR

typedef enum MT {
  FOREACH_MT(GEN_ENUM_MT),
  MT_FAIL = DFAIL
} MT;

typedef enum States {
  FOREACH_MT(GEN_ENUM),
  FOREACH_STATE(GEN_ENUM)
} States;

const char* STATES[] = {
  FOREACH_MT(GEN_STR),
  FOREACH_STATE(GEN_STR)
};

typedef struct Frame {
  // major type, or FAIL
  MT mt;

  // pos mt: number of bytes in val (0,1,2,4,8)
  // -2,-3: number of bytes in chunk, -1 when done
  // -4,-5: total items, -1 when done
  // FAIL: offset from `start` where error was detected
  int bytes;

  // How many items/bytes still need to be read?
  // -1 for streaming
  // -2 for empty array/map
  int left;

  // mt 0,1,7: the value, pre-conversion
  // mt 2,3: total number of bytes
  // mt -2,-3: offset from `start` where chunk begins
  // mt 4,5: total number of items
  // mt -4,-5: index of item, starting at 0
  // mt 6: tag number
  // FAIL: error line number
  int64_t val;
} Frame;

struct Parser {
  States state;
  int depth;
  Frame stack[DMAX_DEPTH];
};
const int PARSER_SIZE = sizeof(Parser);

#define IS_BREAK(frame) (\
  ((frame)->mt == MT_SIMPLE) && \
  ((frame)->bytes == 0) && \
  ((frame)->val == 0x1f))

#ifdef WASM_PRINT
#define PRINT(fmt) print(__LINE__, (fmt))
void print_parser(Parser *parser, int instance) {
  print(-1, instance);
  print(0, parser->state);
  print(1, parser->depth);
  for (int i=0; i<=parser->depth; i++) {
    print(2 + i, parser->stack[i].mt);
    print(2 + i, parser->stack[i].bytes);
    print(2 + i, parser->stack[i].left);
    print(2 + i, parser->stack[i].val);
  }
}
#endif

void init_parser(Parser *parser) {
  parser->state = START;
  parser->depth = 0;
  // don't bother to init stack
}

int parse(Parser *parser, unsigned char *start, int len) {
  static const void *go[] =
  {
    // initial idea from cb0r, thanks Jer
    [0x00 ... 0x17] = &&l_int,
    [0x18] = &&l_int1, [0x19] = &&l_int2, [0x1a] = &&l_int4, [0x1b] = &&l_int8,
    [0x1c ... 0x1e] = &&l_ebad,
    [0x1f] = &&l_until
  };
  int count = 0;
  Frame *frame;
  while (1) {
    unsigned char c = start[count];
    if ((parser->depth < 0) || (parser->depth >= MAX_DEPTH)) {
      frame->val = __LINE__;
      goto l_ebad;
    }
    frame = &(parser->stack[parser->depth]);
    switch (parser->state) {
      case START: {
        if (count >= len) {
          goto l_return;
        }
        frame->bytes = 0;
        frame->left = 0;
        frame->val = 0;
        frame->mt = c >> 5;
        const int lower = c & 0x1f;
        goto *go[lower];

        l_int8:
          frame->bytes += 4;
        l_int4:
          frame->bytes += 2;
        l_int2:
          frame->bytes += 1;
        l_int1:
          frame->bytes += 1;
          frame->left = frame->bytes;
          count++;
          parser->state = COUNT;
          break;
        l_int:
          frame->val = lower;
          count++;
          parser->state = (States)frame->mt;
          break;
        l_until:
          switch (frame->mt) {
            case MT_SIMPLE: // BREAK
              frame->val = lower;
              if (parser->depth < 1) {
                // Starting with FF
                ERROR();
              }
              count++;
              parser->state = END_EMPTY;
              Frame *parent = &(parser->stack[parser->depth - 1]);
              if (parent->left != -1) {
                // FF in a non-streaming container
                ERROR();
              }
              parent->left = 1;
              break;
            case MT_BYTES:
            case MT_UTF8:
            case MT_ARRAY:
            case MT_MAP:
              // Streaming
              frame->val = -1;
              count++;
              parser->state = (States)frame->mt;
              break;
            default:
              ERROR();
              break;
          }
          break;
      }
      case COUNT:
        if (count++ >= len) {
          goto l_return;
        }
        frame->val <<= 8;
        frame->val += c;
        if (--frame->left == 0) {
          switch (frame->bytes) {
            case 1:
              if ((frame->mt == MT_SIMPLE) && (frame->val < 0x20)) {
                ERROR();
              }
              if ((uint64_t)frame->val < 0x18) {
                ERROR();
              }
              break;
            case 2:
              if ((frame->mt != MT_SIMPLE) && ((uint64_t)frame->val < 0x100)) {
                ERROR();
              }
              break;
            case 4:
              if ((frame->mt != MT_SIMPLE) && ((uint64_t)frame->val < 0x10000)) {
                ERROR();
              }
              break;
            case 8:
              if ((frame->mt != MT_SIMPLE) &&
                  ((uint64_t)(frame->val) < 0x100000000)) {
                ERROR();
              }
              break;
          }
          parser->state = (States)frame->mt;
        }
        break;
      case POS:
      case NEG:
      case SIMPLE:
        parser->state = END;
        event(frame->mt, frame->bytes, frame->val, __LINE__);
        break;
      case BYTES:
      case UTF8: {
        event(frame->mt, frame->bytes, frame->val, __LINE__);
        frame->bytes = frame->val;
        frame->val = 0;
        switch (frame->bytes) {
          case -1: {
            // streaming
            frame->left = -1;
            parser->state = START;
            DEEPER();
            break;
          }
          case 0:
            frame->left = 1;
            parser->state = END_EMPTY;
            break;
          default:
            frame->left = frame->bytes;
            parser->state = CHUNKS;
            break;
        }
        break;
      }
      case ARRAY:
      case MAP:
        event(frame->mt, frame->bytes, frame->val, __LINE__);
        frame->bytes = frame->left =
          (frame->val == -1) ? -1 : frame->val << (frame->mt - ARRAY);
        frame->val = 0;
        if (frame->left == 0) {
          parser->state = END_EMPTY;
        } else {
          DEEPER();
          parser->state = START;
        }
        break;
      case TAG:
        event(frame->mt, frame->bytes, frame->val, __LINE__);
        frame->bytes = frame->left = frame->val = 1;
        DEEPER();
        parser->state = START;
        break;
      case CHUNKS:
        if (count >= len) {
          goto l_return;
        }
        frame->bytes = min(frame->left, len - count);
        frame->val = count;
        count += frame->bytes;
        frame->left -= frame->bytes;
        if (frame->left == 0) {
          frame->left = 1;
          parser->state = END_EMPTY;
        }
        event(-frame->mt, frame->bytes, frame->val, __LINE__);
        break;
      case END:
        if (parser->depth > 0) {
          Frame *parent = &(parser->stack[parser->depth - 1]);
          if (parent->bytes == -1) {
            // if we're streaming bytes or strings, the children must match
            if (((parent->mt == BYTES) || (parent->mt == UTF8)) &&
                ((!IS_BREAK(frame) && (parent->mt != frame->mt)) ||
                 (frame->bytes == -1))) { // no nested streams
              ERROR();
            }
          }
          event(-parent->mt, parent->bytes, parent->val++, __LINE__);
          if ((parent->left != -1) && (--parent->left == 0)) {
            // we're done with parent
            parser->depth--;
            event(-parent->mt, -1, -1, __LINE__);
            if (parser->depth < 1) {
              parser->state = START;
              goto l_return;
            }
            parser->state = END;
          } else {
            parser->state = START;
          }
        } else {
          parser->state = START;
          goto l_return;
        }
        break;
      case END_EMPTY: {
        event(-frame->mt, -1, -1, __LINE__);
        if (parser->depth > 0) {
          parser->state = END;
        } else {
          parser->state = START;
          goto l_return;
        }
        break;
      }
      default:
        ERROR();
    }
  }

  l_ebad:
    parser->state = FAIL;
    event(FAIL, count, frame->val, __LINE__);

  l_return:
    return count;
}
