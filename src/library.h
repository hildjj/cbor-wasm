#pragma once

typedef long long int64_t;
typedef unsigned long long uint64_t;

#define DMAX_DEPTH 20
#define DFAIL -128

#define FOREACH_PHASE(FN) \
  FN(BEGIN), \
  FN(ITEM), \
  FN(FINISH), \
  FN(ERROR)

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

typedef enum Phase {
  FOREACH_PHASE(GEN_ENUM)
} Phase;

typedef enum MT {
  FOREACH_MT(GEN_ENUM_MT),
  MT_FAIL = DFAIL
} MT;

typedef enum States {
  FOREACH_MT(GEN_ENUM),
  FOREACH_STATE(GEN_ENUM)
} States;

#ifdef WASM_CBOR_C
extern const char* PHASES[];
extern const char* STATES[];
#endif

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
  uint64_t val;
} Frame;

struct Parser {
  uint64_t last_val;
  States state;
  int depth;
  Frame stack[DMAX_DEPTH];
};
#define DPARSER_SIZE sizeof(Parser)

extern void event(int type, int bytes, Phase phase, int line);

#ifdef WASM_PRINT
extern void print(int where, int fmt);
#endif

typedef struct Parser Parser;
extern const int PARSER_SIZE;
extern const int MAX_DEPTH;
extern const int FAIL;

void init_parser(Parser *parser);
int parse(Parser *parser, unsigned char *start, int len);
