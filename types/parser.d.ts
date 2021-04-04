/**
 * @typedef ParserOptions - options for Parser
 * @property {ParserCallback} [callback=defaultCallback] - to be called when an
 *   item is decoded.  NOT called by base class ever.
 * @property {boolean} [verbose=false] - print out the {@link ParserEvent}
 */
/**
 * Base class for use of the WASM library.  Loads, compiles, and instantiates
 * WASM, and sets up memory for calling in both directions.
 *
 * @property {number} parser - pointer to parser structure in WASM memory
 * @property {number} data - pointer to start of input data area in WASM memory
 * @property {Uint8Array} writeBuffer - a view over the memory the parser
 *   can read from starting at {@linkcode data}.  You can use this instead of
 *   passing bytes into {@linkcode Parser#write} to avoid a copy.
 * @property {number} max - length of {@linkcode writeBuffer}
 */
export class Parser {
    /**
     * Create
     *
     * @param {ParserOptions|ParserCallback} [opts = {}] - options or callback
     *   function
     */
    constructor(opts?: ParserOptions | ParserCallback);
    opts: {
        /**
         * - to be called when an
         * item is decoded.  NOT called by base class ever.
         */
        callback: ParserCallback;
        /**
         * - print out the {@link ParserEvent}
         */
        verbose: boolean;
    };
    /** @type {number?} */
    parser: number | null;
    td: TextDecoder;
    /**
     * Reset the state of the parser, for example, after an error.
     */
    reset(): void;
    /**
     * Initializes this instance.  MUST be called and awaited for before anything
     * else is called.
     */
    init(): Promise<void>;
    /** @type {object} */
    mod: object;
    /** @type {number} */
    data: number;
    mem: Uint8Array;
    writeBuffer: Uint8Array;
    max: number;
    dv: DataView;
    /**
     * Process an event
     *
     * @param {number} mt - Major Type, one of MT
     * @param {number} bytes - Number of bytes or items
     * @param {number} phase - parsing phase, one of PHASES
     * @param {number} line - Line number from library.c, source of the event
     * @returns {void}
     * @abstract
     * @protected
     */
    protected _event(mt: number, bytes: number, phase: number, line: number): void;
    /**
     * Write some bytes to the WASM library, generating synchronous events
     * as needed for the received bytes.
     *
     * @param {Uint8Array|String} [buf] - Bytes to write.  If string, it must
     *   be encoded as hex.  If null, use
     *   {@linkcode Parser#writeBuffer this.writeBuffer} directly, without
     *   the need to copy.
     * @param {number} [start=0] - where to start processing, in bytes
     * @param {number} [end=buf.length] - where to end processing, in bytes.  If
     *   buf is null, REQUIRED
     * @returns {number} number of bytes used.  This will be less than
     *   (end - start) if a full CBOR item is found.
     * @throws {Exception} when buf and end are both null
     */
    write(buf?: Uint8Array | string, start?: number, end?: number): number;
    /**
     * Get the parser's last value
     *
     * @param {number} mt - Major Type, one of MT
     * @param {number} bytes - Number of bytes or items
     * @param {number} phase - parsing phase, one of PHASES
     * @param {number} line - Line number from library.c, source of the event
     */
    baseEvent(mt: number, bytes: number, phase: number, line: number): bigint;
}
/**
 * - compilation phases
 */
export type PHASES = {
    /**
     * - 0
     */
    BEGIN: number;
    /**
     * - 1
     */
    BETWEEN_ITEMS: number;
    /**
     * - 2
     */
    AFTER_ITEMS: number;
    /**
     * - 3
     */
    FINISH: number;
    /**
     * - 4
     */
    ERROR: number;
};
/**
 * @typedef {Object} PHASES - compilation phases
 * @property {number} BEGIN - 0
 * @property {number} BETWEEN_ITEMS - 1
 * @property {number} AFTER_ITEMS - 2
 * @property {number} FINISH - 3
 * @property {number} ERROR - 4
 */
export const PHASES: {};
/**
 * - Major Types
 */
export type MT = {
    /**
     * - 0
     */
    POS: number;
    /**
     * - 1
     */
    NEG: number;
    /**
     * - 2
     */
    BYTES: number;
    /**
     * - 3
     */
    UTF8: number;
    /**
     * - 4
     */
    ARRAY: number;
    /**
     * - 5
     */
    MAP: number;
    /**
     * - 6
     */
    TAG: number;
    /**
     * - 7
     */
    SIMPLE: number;
};
/**
 * @typedef {Object} MT - Major Types
 * @property {number} POS - 0
 * @property {number} NEG - 1
 * @property {number} BYTES - 2
 * @property {number} UTF8 - 3
 * @property {number} ARRAY - 4
 * @property {number} MAP - 5
 * @property {number} TAG - 6
 * @property {number} SIMPLE - 7
 */
export const MT: {};
export type ParserEvent = (mt: number, bytes: number, phase: number, line: number) => any;
export type ParserCallback = (error?: Error, value?: any) => any;
/**
 * - options for Parser
 */
export type ParserOptions = {
    /**
     * - to be called when an
     * item is decoded.  NOT called by base class ever.
     */
    callback?: ParserCallback;
    /**
     * - print out the {@link ParserEvent}
     */
    verbose?: boolean;
};
