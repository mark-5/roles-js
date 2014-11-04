(function(root, factory){
    if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
        var _ = require('underscore');
        module.exports = factory(_);
    } else {
        root.HashOfRefs = factory(root._);
    }
})(this, function(_){
    var HashOfRefs = function(){
        this._elements = _.map(arguments, function(el){ return el });
    };
    HashOfRefs.prototype = new function(){
        this._get_pair = function(ref) { return _.find(this._elements, function(pair){ return pair[0] === ref }) };

        this.keys   = function()   { return _.map(this._elements, function(pair){ return pair[0] }) };
        this.values = function()   { return _.map(this._elements, function(pair){ return pair[1] }) };
        this.pairs  = function()   { return this._elements };
        this.has    = function(ref){ return _.some(this._elements, function(pair){ return pair[0] === ref }) };
        this.get = function(ref){
            var pair = this._get_pair(ref);
            return pair && pair[1];
        };
        this.set = function(ref, val){
            var exists = this._get_pair(ref);
            if (exists) {
                var idx = _.indexOf(this._elements, exists);
                this._elements[idx] = [ref, val];
            } else {
                this._elements.push([ref, val]);
            }
            return exists && exists[1];
        };
        this.unset = function(ref){
            var pair = this._get_pair(ref);
            if (!pair) return undefined;
            var idx = _.indexOf(this._elements, pair);
            var spliced = this._elements.splice(idx);
            return spliced[0];
        };
    };

    return HashOfRefs;
});
