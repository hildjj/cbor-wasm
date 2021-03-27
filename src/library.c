#include "library.h"

#pragma GCC diagnostic ignored "-Wgnu-label-as-value"
#pragma GCC diagnostic ignored "-Wgnu-designator"

const int FAIL = DFAIL;
const int MAX_DEPTH = DMAX_DEPTH;
const int PARSER_SIZE = DPARSER_SIZE;

#ifdef WASM_CBOR_C
const char* STATES[] = {FOREACH_MT(GEN_STR), FOREACH_STATE(GEN_STR)};
const char* PHASES[] = {FOREACH_PHASE(GEN_STR)};
#endif

#define ERROR()            \
  {                        \
    frame->val = __LINE__; \
    goto l_ebad;           \
  }

#define DEEPER()                       \
  {                                    \
    if (++parser->depth >= DMAX_DEPTH) \
      ERROR()                          \
  }

#define min(a, b) (((a) < (b)) ? (a) : (b))

#define IS_BREAK(frame)                                   \
  (((frame)->mt == MT_SIMPLE) && ((frame)->bytes == 0) && \
   ((frame)->val == 0x1f))

#ifdef WASM_PRINT
#define PRINT(fmt) print(__LINE__, (fmt))
void print_parser(Parser* parser, int instance) {
  print(-1, instance);
  print(0, parser->state);
  print(1, parser->depth);
  for (int i = 0; i <= parser->depth; i++) {
    print(2 + i, parser->stack[i].mt);
    print(2 + i, parser->stack[i].bytes);
    print(2 + i, parser->stack[i].left);
    print(2 + i, parser->stack[i].val);
  }
}
#endif

void init_parser(Parser* parser) {
  parser->state = START;
  parser->depth = 0;
  // don't bother to init stack
}

int parse(Parser* parser, unsigned char* start, int len) {
  static const void* go[] = {
      // initial idea from cb0r, thanks Jer
      [0x00 ... 0x17] = &&l_int, [0x18] = &&l_int1, [0x19] = &&l_int2,
      [0x1a] = &&l_int4,         [0x1b] = &&l_int8, [0x1c ... 0x1e] = &&l_ebad,
      [0x1f] = &&l_until};
  int count = 0;
  Frame* frame;
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
        goto* go[lower];

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
          case MT_SIMPLE:  // BREAK
            frame->bytes = 0;
            frame->val = lower;
            if (parser->depth < 1) {
              // Starting with FF
              ERROR();
            }
            Frame* parent = &(parser->stack[parser->depth - 1]);
            if (parent->left != -1) {
              // FF in a non-streaming container
              ERROR();
            }
            count++;
            parser->state = END_EMPTY;
            parent->left = 1;
            break;
          case MT_BYTES:
          case MT_UTF8:
          case MT_ARRAY:
          case MT_MAP:
            // Streaming
            frame->bytes = -1;
            frame->val = 0;
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
              if ((frame->mt != MT_SIMPLE) &&
                  ((uint64_t)frame->val < 0x10000)) {
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
        parser->last_val = frame->val;
        event(frame->mt, frame->bytes, FINISH, __LINE__);
        break;
      case BYTES:
      case UTF8:
        parser->last_val = frame->val;
        event(frame->mt, frame->bytes, BEGIN, __LINE__);
        if (frame->bytes == -1) {
          // streaming
          frame->left = -1;
          parser->state = START;
          DEEPER();
        } else if (frame->val == 0) {
          frame->left = 1;
          parser->state = END_EMPTY;
        } else {
          frame->bytes = frame->val;
          frame->left = frame->bytes;
          parser->state = CHUNKS;
        }
        frame->val = 0;
        break;
      case ARRAY:
      case MAP:
        parser->last_val = frame->val;
        event(frame->mt, frame->bytes, BEGIN, __LINE__);
        frame->bytes = frame->left =
            (frame->bytes == -1) ? -1 : frame->val << (frame->mt - ARRAY);
        frame->val = 0;
        if (frame->left == 0) {
          parser->state = END_EMPTY;
        } else {
          DEEPER();
          parser->state = START;
        }
        break;
      case TAG:
        parser->last_val = frame->val;
        event(frame->mt, frame->bytes, BEGIN, __LINE__);
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
        parser->last_val = frame->val;
        event(frame->mt, frame->bytes, ITEM, __LINE__);
        break;
      case END:
        if (parser->depth > 0) {
          Frame* parent = &(parser->stack[parser->depth - 1]);
          if (parent->bytes == -1) {
            // if we're streaming bytes or strings, the children must match
            if (((parent->mt == BYTES) || (parent->mt == UTF8)) &&
                ((!IS_BREAK(frame) && (parent->mt != frame->mt)) ||
                 (frame->bytes == -1))) {  // no nested streams
              ERROR();
            }
          }
          parser->last_val = parent->val++;
          event(parent->mt, parent->bytes, ITEM, __LINE__);
          if ((parent->left != -1) && (--parent->left == 0)) {
            // we're done with parent
            parser->depth--;
            parser->last_val = parent->val;
            event(parent->mt, -1, FINISH, __LINE__);
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
        parser->last_val = IS_BREAK(frame) ? 0x1f : 0;
        event(frame->mt, IS_BREAK(frame) ? 0 : -1, FINISH, __LINE__);
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
  parser->state = START;
  parser->last_val = frame->val;
  event(FAIL, count, ERROR, __LINE__);

l_return:
  return count;
}

double float64(uint64_t* u) {
  return *(double*)u;
}

double float16(short* inp) {
  unsigned long long sign = *inp & 0x8000;
  unsigned long long exp = *inp & 0x7C00;
  unsigned long long mant = *inp & 0x03ff;
  if (!exp) {
    return (sign ? -1 : 1) * mant * 0x1p-24;
  }
  if (exp == 0x7c00) {
    return (sign ? -1 : 1) * (mant ? 0.0 / 0.0 : 1.0 / 0.0);
  }
  // 0xfc000 is (1023 - 15) << 10 (the biases)
  // 42 is 52bits of integer, and we had 10 to start with
  unsigned long long bits =
      (sign << 48) | ((exp + 0xfc000) << 42) | (mant << 42);
  return *(double*)&bits;
}
