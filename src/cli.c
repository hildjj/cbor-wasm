#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <stdio.h>

#include "library.h"

void event(int type, int bytes, int64_t value, int line) {
  // \x1b[32m-----\x1b[0m
  printf("-----\ntype: %d\nbytes: %d\nvalue: %lld\nline: %d\n",
         type, bytes, value, line);
}

void print(int where, int fmt) {
  switch (where) {
    case -1:
      printf("P -----\nP line: %d\n", fmt);
      break;
    case 0:
      if (fmt != FAIL) {
        printf("P state: %s\n", STATES[fmt]);
      } else {
        printf("P state: FAIL\n");
      }
      break;
    case 1:
      printf("P depth: %d\n", fmt);
      break;
    default:
      printf("P %d %d\n", where, fmt);
      break;
  }
}

unsigned char *unHex(char *hex, size_t *blen) {
  const size_t len = strlen(hex);
  *blen = len / 2;
  unsigned char *ret = malloc(*blen + 1);
  for (size_t i = 0; i < len; i += 2) {
    unsigned char high = toupper(hex[i]);
    high = (high > 0x39) ? high - 0x37 : high - 0x30;

    unsigned char low  = toupper(hex[i + 1]);
    low = (low > 0x39) ? low - 0x37 : low - 0x30;
    ret[i / 2] = (high << 4) | low;
  }
  ret[*blen] = 0;
  return ret;
}

int main(int argc, char **argv) {
  Parser *p = (Parser*) malloc(PARSER_SIZE);
  init_parser(p);

  for (int i = 1; i < argc; i++) {
    size_t blen;
    unsigned char *h = unHex(argv[i], &blen);
    parse(p, h, blen);
    free(h);
  }
  const int state = *(int*)p;
  if (state == FAIL) {
    printf("End state: FAIL\n");
  } else {
    printf("End state: %s\n", STATES[state]);
  }
  printf("End depth: %d\n", *((int*)p + 1));
  return 0;
}
