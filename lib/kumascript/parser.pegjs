/*
 * PEG.js parser for macros in wiki documents.
 */
start = Document

Document = ( Macro / Text )+

Text = c:Chars+ {
    return {
        type: "TEXT",
        chars: c.join('')
    };
}

Chars = c:( CharsNoBraces / SingleLeftBrace / SingleRightBrace ) {
    return c.join('');
}

CharsNoBraces = [^{}]+
SingleLeftBrace = "{" [^{]
SingleRightBrace = "}" [^}]

Macro = "{{" __ name:MacroName __ args:Arguments? __ "}}" { 
    return {
        type: 'MACRO',
        name: name.join(''),
        arguments: args || []
    };
}

/* Trying to be inclusive here, but want to exclude start of params and end of
   macro */
MacroName = [^\(\} ]+

Arguments
  = "(" __ args:ArgumentList? __ ")" { return args; }

ArgumentList
  = head:Argument tail:(__ "," __ Argument)* {
        var result = [head];
        for (var i = 0; i < tail.length; i++) {
            result.push(tail[i][3]);
        }
        return result;
    }

Argument
  = c:( Number / DoubleArgumentChars / SingleArgumentChars )

Number = c:[\-.0-9]+ { return parseInt(c.join('')); }

DoubleArgumentChars
  = '"' c:DoubleArgumentChar+ '"' { return c.join(''); }

SingleArgumentChars
  = "'" c:SingleArgumentChar+ "'" { return c.join(''); }

DoubleArgumentChar 
  = [^"\\] / '\\"' { return '"'; }

SingleArgumentChar 
  = [^'\\] / "\\'" { return "'"; }

__ = whitespace*

whitespace = [ \t\n\r]
