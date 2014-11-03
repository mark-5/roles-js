var assert     = require('assert');
var _          = require('underscore');
var HashOfRefs = require("../hash_of_refs.js");

describe('HashOfRefs', function(){
    it('CRUD', function(){
        var hash = new HashOfRefs();
        var o1 = {}; var o2 = {};

        hash.set(o1, 'o1');
        hash.set(o2, 'o2');
        assert.equal(hash.get(o1), 'o1', 'got first ref val');
        assert.equal(hash.get(o2), 'o2', 'got second ref val');
        assert.ok(_.every([o1, o2], function(key){ return _.contains(hash.keys(), key) }), 'refs returned from keys');

        assert.ok(hash.has(o1), 'hash has first ref');
        hash.unset(o1);
        assert.ok(!hash.has(o1), 'hash does not have first ref after unset');

        var changed = 'changed o2';
        hash.set(o2, changed);
        assert.equal(hash.get(o2), changed, 'got ref val changed with set');

        var arg1 = {}; var arg2 = {};
        var with_args = new HashOfRefs([arg1, null], [arg2, null]);
        assert.ok(
            _.every([arg1, arg2], function(key){ return _.contains(with_args.keys(), key) }),
            'constructor refs returned from keys'
        );
    });
});

