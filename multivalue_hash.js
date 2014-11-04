(function(root, factory){
    if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
        var _ = require('underscore');
        module.exports = factory(_);
    } else {
        root.HashOfRefs = factory(root._);
    }
})(this, function(_){
    var MultiValueHash = function(){
        this._hash = {};

        var me = this;
        _.each(arguments, function(pair){ me.add(pair[0], pair[1]) });
    };
    MultiValueHash.prototype = new function(){
        this.get = function(key){
            var values = this._hash[key];
            if (!values) return undefined;
            return _.last(values);
        };
        this.get_all = function(key){ return this._hash[key] || [] };
        this.add = function(key, value){
            var values = this._hash[key] || [];
            if (_.contains(values, value)) return undefined;
            return this.set(key, _.flatten([values, value], true));
        };
        this.set = function(key, values){ var old = this._hash[key]; this._hash[key] = values; return old };
        this.unset = function(key) { return this.set(key, []) }
        this.keys = function(){ return _.keys(this._hash) };
        this.values = function(){ return _.values(this._hash) };

        this.clone = function(){
            var clone = new MultiValueHash;
            clone._hash = _.clone(this.as_hash());
            _.each(clone._hash, function(vals, key){ clone[key] = _.map(vals, function(val){ return val }) });
            return clone;
        };

        this.merge = function(){
            var me = this.clone();

            var hashes = arguments;
            _.each(hashes, function(hash){
                if (hash instanceof MultiValueHash) {
                    _.each(hash.as_hash(), function(vals, key){
                        _.each(vals, function(val){ me.add(key, val) });
                    });
                } else {
                    _.each(hash, function(val, key){ me.add(key, val) });
                }
            });
            return me;
        };

        this.as_hash = function(){ return this._hash };
    };

    return MultiValueHash;
});
