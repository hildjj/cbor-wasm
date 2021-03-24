#pragma once

typedef long long int64_t;
typedef unsigned long long uint64_t;
extern void event(int type, int bytes, int64_t value, int line);

#ifdef WASM_PRINT
extern void print(int where, int fmt);
#endif

struct Parser;
typedef struct Parser Parser;
extern const int PARSER_SIZE;
extern const int MAX_DEPTH;
extern const char* STATES[];
extern const int FAIL;

void init_parser(Parser *parser);
int parse(Parser *parser, unsigned char *start, int len);
