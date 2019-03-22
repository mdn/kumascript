/**
 * @prettier
 */
/// <reference types="pegjs"/>
import { PegjsError, ParserOptions } from 'pegjs';

export type SyntaxError = PegjsError;
export var SyntaxError: any;

export function parse(input: string, options?: ParserOptions): any;
