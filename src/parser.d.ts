/**
 * @prettier
 */
import { LocationRange, ParserOptions, PegjsError } from 'pegjs';

export interface SyntaxError extends PegjsError {
    name: 'SyntaxError';
}
export const SyntaxError: any;

export type KSToken = KSTextToken | KSMacroToken;
export interface KSTextToken {
    type: 'TEXT';
    chars: string;
}
export interface KSMacroToken {
    type: 'MACRO';
    name: string;
    args: any[];
    location: LocationRange;

    /**
     * Internal signature used by render in the form of:
     * `name + JSON.stringify(args)`
     */
    signature?: string;
}

export function parse(input: string, options?: ParserOptions): KSToken[];
