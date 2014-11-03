var assert         = require('assert');
var _              = require('underscore');
var MultiValueHash = require("../multivalue_hash.js");

describe('MultiValueHash', function(){
    it('CRUD', function(){
        var hash = new MultiValueHash(['first', 1], ['first', 2], ['second',1]);
        assert.deepEqual(hash.as_hash(), {first: [1,2], second: [1]}, 'returned sensible hash representation');

        assert.equal(hash.get('first'), 2, 'got last value for first key');
        assert.deepEqual(hash.get_all('first'), [1, 2], 'got all values for first key');

        assert.equal(hash.get('second'), 1, 'got value for second key');
        assert.deepEqual(hash.get_all('second'), [1], 'get_all returned value for second key');

        assert.deepEqual(_.difference(hash.keys(), ['first', 'second']), [], 'returned all keys');
        assert.deepEqual(
            _.difference(hash.values(), _.map(hash.keys(), function(key){ return hash.get_all(key) })),
            [],
            'returned all values'
        );

        hash.add('new', 'key');
        assert.equal(hash.get('new'), 'key', 'added new key');
        hash.set('new', ['changed']);
        assert.deepEqual(hash.get_all('new'), ['changed'], 'set new key');
        hash.unset('new');
        assert.deepEqual(hash.get_all('new'), [], 'unset new key');

        hash.add('foo', 'bar');
        hash.add('foo', 'bar');
        assert.deepEqual(hash.get_all('foo'), ['bar'], 'ignore adding duplicate values for key');
    });
    it('clone', function(){
        var orig = new MultiValueHash(['first', 1], ['first', 2]);
        var clone = orig.clone();
        clone.add('first', 3);
        assert.deepEqual(clone.get_all('first'), [1,2,3], 'clone added value');
        assert.deepEqual(orig.get_all('first'), [1,2], 'original hash unmodified');
    });
    it('merge', function(){
        var first  = new MultiValueHash(['first', 1]);
        var second = new MultiValueHash(['first', 2], ['second', 1]);

        var merged = first.merge(second);
        var expected = {first: [1, 2], second: [1]};
        assert.deepEqual(merged.as_hash(), expected, 'multivalue merge merged as expected');
        assert.deepEqual(first.as_hash(), {first: [1]}, 'merge did not modify original hash');
    });
});
