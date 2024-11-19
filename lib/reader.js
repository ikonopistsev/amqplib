'use strict';

var headerReader = [];

headerReader['V'] = function(key, slice, offset) {
    return { value: null, size: 0 };
}
headerReader['t'] = function(key, slice, offset) {
    return { value: slice[offset] != 0, size: 1 };
}
headerReader['b'] = function(key, slice, offset) {
    return { value: slice.readInt8(offset), size: 1 };
}
headerReader['B'] = function(key, slice, offset) {
    return { value: slice.readUInt8(offset), size: 1 };
}
headerReader['u'] = function(key, slice, offset) {
    return { value: slice.readInt16BE(offset), size: 2 };
}
headerReader['U'] = function(key, slice, offset) {
    return { value: slice.readUInt16BE(offset), size: 2 };
}
headerReader['i'] = function(key, slice, offset) {
    return { value: slice.readInt32BE(offset), size: 4 };
}
headerReader['I'] = function(key, slice, offset) {
    return { value: slice.readUInt32BE(offset), size: 4 };
}
headerReader['l'] = function(key, slice, offset) {
    return { value: parseInt(slice.readBigUInt64BE(offset)), size: 8 };
}
headerReader['L'] = function(key, slice, offset) {
    return { value: parseInt(slice.readBigInt64BE(offset)), size: 8 };
}
headerReader['f'] = function(key, slice, offset) {
    return { value: slice.readFloatBE(offset), size: 4 };
}
headerReader['d'] = function(key, slice, offset) {
    return { value: slice.readDoubleBE(offset), size: 8 };
}
headerReader['s'] = function(key, slice, offset) {
    var len = slice.readUInt8(offset);
    var p = offset + 1;
    var r = { value : slice.toString('utf8', p, p + len), size: 1 + len };
    return r;
}
headerReader['S'] = function(key, slice, offset) {
    var len = slice.readUInt32BE(offset);
    var p = offset + 4;
    var r = { value : slice.toString('utf8', p, p + len), size: 4 + len };
    return r;
}

// Assume we're given a slice of the buffer that contains just the
// fields.
function decodeFields2(slice) {
    var fields = {}, offset = 0, size = slice.length;
    var len, key, val;

    function decodeByTag(tag) {
        var reader = headerReader[tag];
        if (reader) {
            var res = reader(key, slice, offset);
            val = res.value;
            offset += res.size;
        } else {
            throw new TypeError('Unexpected type tag "' + tag +'"');
        }
    }

    function decodeFieldValue() {
        var tag = String.fromCharCode(slice[offset]); offset++;
        switch (tag) {
            case 'A':
                len = slice.readUInt32BE(offset); offset += 4;
                decodeArray(offset + len);
                // NB decodeArray will itself update offset and val
                break;
            case 'F':
                len = slice.readUInt32BE(offset); offset += 4;
                val = decodeFields2(slice.subarray(offset, offset + len));
                offset += len;
                break;
            case 'D': // only positive decimals, apparently.
                var places = slice[offset]; offset++;
                var digits = slice.readUInt32BE(offset); offset += 4;
                val = {'!': 'decimal', value: {places: places, digits: digits}};
                break;
            case 'T':
                val = slice.readBigUInt64BE(offset); offset += 8;
                val = {'!': 'timestamp', value: parseInt(val) };
                break;
            default:
                decodeByTag(tag);
        }
    }

    function decodeArray(until) {
        var vals = [];
        while (offset < until) {
            decodeFieldValue();
            vals.push(val);
        }
        val = vals;
    }

    while (offset < size) {
        len = slice.readUInt8(offset); offset++;
        key = slice.toString('utf8', offset, offset + len);
        offset += len;
        decodeFieldValue();
        fields[key] = val;
    }
    return fields;
}

module.exports.headerReader = headerReader;
module.exports.decodeFields = decodeFields2;