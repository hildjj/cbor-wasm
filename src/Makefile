CLANG = clang
INPUT = library.c
OUTPUT = ../lib/library.wasm
#OPTIMIZE = -Os -flto -Wl,--strip-all -Wl,--lto-O3 -Wl,-O3
OPTIMIZE = -g
CLI = cbor-cli

.PHONY: all
all: wat $(CLI)

$(CLI): *.c *.h Makefile
	$(CLANG) -fdiagnostics-absolute-paths -W -Wall -Wextra -pedantic -o $(CLI) -g *.c

$(OUTPUT): $(INPUT) *.h Makefile
	$(CLANG) \
	-fdiagnostics-absolute-paths \
	-W -Wall -Wextra \
	--target=wasm32-unknown-unknown \
	$(OPTIMIZE) \
	-nostdlib \
	-fvisibility=hidden \
	-ffunction-sections \
	-fdata-sections \
	-Wl,--no-entry \
	-Wl,--export-all \
	-Wl,--allow-undefined \
	-Wl,--initial-memory=131072 \
	-Wl,-error-limit=0 \
	-Wl,--gc-sections \
	-o $@ \
	$<

library.wat: $(OUTPUT) Makefile
	wasm2wat -o library.wat $(OUTPUT)

wat: library.wat

clean:
	$(RM) $(OUTPUT) library.wat $(CLI)
	$(RM) -r *.dSYM
