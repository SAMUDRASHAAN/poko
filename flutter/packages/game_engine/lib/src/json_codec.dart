String encodeJson(Object? value) {
  final output = StringBuffer();
  _writeJson(output, value);
  return output.toString();
}

Object? decodeJson(String source) {
  final parser = _JsonParser(source);
  final value = parser.parseValue();
  parser.skipWhitespace();
  if (!parser.isAtEnd) {
    throw FormatException('unexpected trailing JSON', source, parser.offset);
  }
  return value;
}

void _writeJson(StringBuffer output, Object? value) {
  switch (value) {
    case null:
      output.write('null');
    case bool():
      output.write(value ? 'true' : 'false');
    case int():
      output.write(value);
    case double():
      if (!value.isFinite) {
        output.write('null');
      } else if (value == value.truncateToDouble()) {
        output.write(value.toInt());
      } else {
        output.write(value);
      }
    case String():
      _writeString(output, value);
    case List<Object?>():
      output.write('[');
      for (var index = 0; index < value.length; index += 1) {
        if (index > 0) {
          output.write(',');
        }
        _writeJson(output, value[index]);
      }
      output.write(']');
    case Map<String, Object?>():
      output.write('{');
      var first = true;
      for (final entry in value.entries) {
        if (!first) {
          output.write(',');
        }
        first = false;
        _writeString(output, entry.key);
        output.write(':');
        _writeJson(output, entry.value);
      }
      output.write('}');
    default:
      throw ArgumentError.value(value, 'value', 'is not JSON encodable');
  }
}

void _writeString(StringBuffer output, String value) {
  output.write('"');
  for (final codeUnit in value.codeUnits) {
    switch (codeUnit) {
      case 0x08:
        output.write(r'\b');
      case 0x09:
        output.write(r'\t');
      case 0x0a:
        output.write(r'\n');
      case 0x0c:
        output.write(r'\f');
      case 0x0d:
        output.write(r'\r');
      case 0x22:
        output.write(r'\"');
      case 0x5c:
        output.write(r'\\');
      default:
        if (codeUnit < 0x20) {
          output.write('\\u${codeUnit.toRadixString(16).padLeft(4, '0')}');
        } else {
          output.writeCharCode(codeUnit);
        }
    }
  }
  output.write('"');
}

final class _JsonParser {
  _JsonParser(this.source);

  final String source;
  int offset = 0;

  bool get isAtEnd => offset >= source.length;

  void skipWhitespace() {
    while (!isAtEnd) {
      final codeUnit = source.codeUnitAt(offset);
      if (codeUnit != 0x20 &&
          codeUnit != 0x09 &&
          codeUnit != 0x0a &&
          codeUnit != 0x0d) {
        break;
      }
      offset += 1;
    }
  }

  Object? parseValue() {
    skipWhitespace();
    if (isAtEnd) {
      throw FormatException('expected JSON value', source, offset);
    }
    return switch (source.codeUnitAt(offset)) {
      0x22 => _parseString(),
      0x5b => _parseArray(),
      0x7b => _parseObject(),
      0x74 => _parseLiteral('true', true),
      0x66 => _parseLiteral('false', false),
      0x6e => _parseLiteral('null', null),
      _ => _parseNumber(),
    };
  }

  Object? _parseLiteral(String literal, Object? value) {
    if (!source.startsWith(literal, offset)) {
      throw FormatException('invalid JSON literal', source, offset);
    }
    offset += literal.length;
    return value;
  }

  String _parseString() {
    offset += 1;
    final output = StringBuffer();
    while (!isAtEnd) {
      final codeUnit = source.codeUnitAt(offset++);
      if (codeUnit == 0x22) {
        return output.toString();
      }
      if (codeUnit != 0x5c) {
        if (codeUnit < 0x20) {
          throw FormatException('control character in string', source, offset);
        }
        output.writeCharCode(codeUnit);
        continue;
      }
      if (isAtEnd) {
        throw FormatException('unterminated JSON escape', source, offset);
      }
      final escaped = source.codeUnitAt(offset++);
      switch (escaped) {
        case 0x22:
        case 0x2f:
        case 0x5c:
          output.writeCharCode(escaped);
        case 0x62:
          output.writeCharCode(0x08);
        case 0x66:
          output.writeCharCode(0x0c);
        case 0x6e:
          output.writeCharCode(0x0a);
        case 0x72:
          output.writeCharCode(0x0d);
        case 0x74:
          output.writeCharCode(0x09);
        case 0x75:
          if (offset + 4 > source.length) {
            throw FormatException('short unicode escape', source, offset);
          }
          final hexadecimal = source.substring(offset, offset + 4);
          final decoded = int.tryParse(hexadecimal, radix: 16);
          if (decoded == null) {
            throw FormatException('invalid unicode escape', source, offset);
          }
          output.writeCharCode(decoded);
          offset += 4;
        default:
          throw FormatException('invalid JSON escape', source, offset);
      }
    }
    throw FormatException('unterminated JSON string', source, offset);
  }

  List<Object?> _parseArray() {
    offset += 1;
    final values = <Object?>[];
    skipWhitespace();
    if (!isAtEnd && source.codeUnitAt(offset) == 0x5d) {
      offset += 1;
      return values;
    }
    while (true) {
      values.add(parseValue());
      skipWhitespace();
      if (isAtEnd) {
        throw FormatException('unterminated JSON array', source, offset);
      }
      final separator = source.codeUnitAt(offset++);
      if (separator == 0x5d) {
        return values;
      }
      if (separator != 0x2c) {
        throw FormatException('expected comma in array', source, offset);
      }
    }
  }

  Map<String, Object?> _parseObject() {
    offset += 1;
    final values = <String, Object?>{};
    skipWhitespace();
    if (!isAtEnd && source.codeUnitAt(offset) == 0x7d) {
      offset += 1;
      return values;
    }
    while (true) {
      skipWhitespace();
      if (isAtEnd || source.codeUnitAt(offset) != 0x22) {
        throw FormatException('expected object key', source, offset);
      }
      final key = _parseString();
      skipWhitespace();
      if (isAtEnd || source.codeUnitAt(offset++) != 0x3a) {
        throw FormatException(
          'expected colon after object key',
          source,
          offset,
        );
      }
      values[key] = parseValue();
      skipWhitespace();
      if (isAtEnd) {
        throw FormatException('unterminated JSON object', source, offset);
      }
      final separator = source.codeUnitAt(offset++);
      if (separator == 0x7d) {
        return values;
      }
      if (separator != 0x2c) {
        throw FormatException('expected comma in object', source, offset);
      }
    }
  }

  num _parseNumber() {
    final start = offset;
    if (source.codeUnitAt(offset) == 0x2d) {
      offset += 1;
    }
    while (!isAtEnd && _isDigit(source.codeUnitAt(offset))) {
      offset += 1;
    }
    var isDouble = false;
    if (!isAtEnd && source.codeUnitAt(offset) == 0x2e) {
      isDouble = true;
      offset += 1;
      while (!isAtEnd && _isDigit(source.codeUnitAt(offset))) {
        offset += 1;
      }
    }
    if (!isAtEnd &&
        (source.codeUnitAt(offset) == 0x65 ||
            source.codeUnitAt(offset) == 0x45)) {
      isDouble = true;
      offset += 1;
      if (!isAtEnd &&
          (source.codeUnitAt(offset) == 0x2b ||
              source.codeUnitAt(offset) == 0x2d)) {
        offset += 1;
      }
      while (!isAtEnd && _isDigit(source.codeUnitAt(offset))) {
        offset += 1;
      }
    }
    final token = source.substring(start, offset);
    final value = isDouble ? double.tryParse(token) : int.tryParse(token);
    if (value == null) {
      throw FormatException('invalid JSON number', source, start);
    }
    return value;
  }
}

bool _isDigit(int codeUnit) => codeUnit >= 0x30 && codeUnit <= 0x39;
