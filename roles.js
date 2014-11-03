var _              = require("underscore");
var HashOfRefs     = require("./hash_of_refs.js");
var MultiValueHash = require("./multivalue_hash.js");

var inherits_from = function(subclass, superclass){
    var Surrogate = function(){};
    Surrogate.prototype = obj.subclass;
    return (new Surrogate) instanceof superclass;
};

var extend_class = function(mapping){
    var klass = this;
    var child = function(){ return klass.apply(this, arguments) };
    var Surrogate = function(){ this.constructor = child };
    Surrogate.prototype = klass.prototype;
    child.prototype = new Surrogate;
    _.extend(child.prototype, mapping);
    return child;
};

var method_modifiers = ['before', 'after', 'around'];
var not_methods = _.flatten([method_modifiers, 'with', 'requires']);
var MetaRole = new function(){
    this._roles = [];
    this._consumers = new HashOfRefs;

    this.is_role = function(role) { return role instanceof Role };
    this.does_role = function(klass, role) {
        if (this.is_role(klass)) {
            return _.contains(klass.applied(), role);
        } else {
            return    _.contains(this._consumers.get(klass), role)
                   || _.contains(this._consumers.get(klass.constructor), role);
        }
    };
    this.apply_roles = function(klass){
        var roles = _.rest(arguments);
        var conflicts = this._get_conflicts(roles);
        if (_.keys(conflicts).length) {
            var methods = _.keys(conflicts).join(',');
            throw "Conflicting methods: " + methods;
        }
        var required  = _.flatten(_.map(roles, function(role){ return role.requires() }), true);
        var provided  = _.extend.apply(_, _.map(roles, function(role){ return role.provides() }));
        var missing   = this._get_missing(klass, provided, required);
        if (missing.length) {
            var methods = missing.join(',');
            throw "Missing methods: " + methods;
        }

        var extend = klass.extend || extend_class;
        var klass_with_role = extend.call(klass, provided);
        this._install_modifiers(klass_with_role, _.map(roles, function(role){ return role.modifiers() }));

        this._consumers.set(klass_with_role, roles);
        return klass_with_role;
    };
    this._get_methods = function(role){ return _.omit(spec, ['before','after','around','with','requires']) };
    this._get_conflicts = function(roles){
        var provided = {}; var conflicts = {};
        _.each(roles, function(role){
            var mapping = role.provides();
            _.each(mapping, function(code, method){
                var exists = provided[method];
                if (!exists) {
                    provided[method] = code;
                } else if (exists !== code) {
                    if (!conflicts[method]) conflicts[method] = [];
                    conflicts[method].push([role, code]);
                }
            });
         });
        return conflicts;
    };
    this._get_missing = function(klass, provided, required){
        return _.reject(required, function(method){ return klass.prototype[method] || provided[method] });
    };
    this._install_modifiers = function(klass, modifiers){
        var me = this;
        var modifier_data = {};
        _.each(modifiers, function(modifier){
            _.each(['before', 'around', 'after'], function(type){
                var methods = modifier[type];
                _.each(methods, function(coderefs, name){
                    if (!modifier_data[name]) modifier_data[name] = {wrapped: klass.prototype[name]};
                    if (type == 'before') {
                        if (!modifier_data[name].before) modifier_data[name].before = [];
                        modifier_data[name].before = _.flatten([coderefs, modifier_data[name].before], true);
                    } else if (type == 'after') {
                        if (!modifier_data[name].after) modifier_data[name].after = [];
                        modifier_data[name].after = _.flatten([modifier_data[name].after, coderefs], true);
                    } else if (type == 'around') {
                        var wrapped = modifier_data[name].wrapped;
                        _.each(coderefs, function(coderef){
                            var wrapped = modifier_data[name].wrapped;
                            modifier_data[name].wrapped = function(){
                                return coderef.apply(this, _.flatten([wrapped, arguments], true));
                            };
                        });
                    }
                });
            });
        });
        _.each(modifier_data, function(modifiers, name){
            klass.prototype[name] = function(){
                var me = this; var args = arguments;
                _.each(modifiers.before||[], function(code){ code.apply(me, args) });
                var retval = modifiers.wrapped.apply(me, args);;
                _.each(modifiers.after||[], function(code){ code.apply(me, args) });
                return retval;
            };
        });
    };
};

var Role = function(spec){
    this.spec = spec;
    var conflicts = this.meta._get_conflicts(spec.with || []);
    if (_.keys(conflicts).length) {
        var methods = _.keys(conflicts).join(',');
        throw "Conflicting methods: " + methods;
    }

    this.freeze();
    return this;
};
Role.prototype = new function(){
    this.meta = MetaRole;
    this.requires = function(){
        var applied = this.spec.with || [];
        var from_spec = this.spec.requires || [];
        var from_applied = _.flatten(
            _.map(applied, function(role){ return role.requires() })
        ,true);
        var modifiers = [this.modifiers()].concat(_.map(applied, function(role){ return role.modifiers() }));
        var from_modifiers = _.chain(modifiers)
                              .map(function(modifier){
                                var method_names = _.map(modifier, function(methods, type){ return _.keys(methods) });
                                return _.flatten(method_names, true);
                              })
                              .flatten(true)
                              .uniq()
                              .value();
        var required = _.flatten([from_spec, from_applied, from_modifiers], true);
        return _.difference(required, this.provides());
    };
    this.provides = function(){
        var not_methods = ['before','after','around','with','requires'];
        var from_spec = _.omit(this.spec, not_methods);
        var from_applied = _.extend.apply(_,
            _.map(this.spec.with||[], function(role){ return role.provides() })
        );
        return _.extend({}, from_spec, from_applied);
    };
    this.modifiers = function(){
        var spec = this.spec;
        var types = ['before','after','around'];
        var modifiers = {};
    
        _.each(types, function(type){
            var from_spec = spec[type] || {};
            var from_applied = _.map(spec.with||[], function(role){ return role.modifiers() });
            modifiers[type] = _.object(_.keys(from_spec), _.map(_.values(from_spec), function(val){ return [val] }));
            _.each(from_applied, function(applied_modifiers){
                _.each(applied_modifiers[type], function(mods, method){
                    modifiers[type][method].concat(mods);
                })
            });
        });

        return modifiers;
    };
    this.applied = function(){
        var roles_applied = [this];
        _.each(this.spec.with||[], function(role){
            roles_applied.push(role);
            _.each(role.applied(), function(role){ roles_applied.push(role) });
        })
        return _.uniq(roles_applied);
    };
    this.freeze = function(){
        var me = this;
        var to_freeze = ['requires', 'provides', 'modifiers', 'applied'];
        _.each(to_freeze, function(method){ me[method] = _.constant(me[method]()) });
    };
};

Role.is_role     = function(){ return MetaRole.is_role.apply(MetaRole,     arguments) };
Role.does_role   = function(){ return MetaRole.does_role.apply(MetaRole,   arguments) };
Role.apply_roles = function(){ return MetaRole.apply_roles.apply(MetaRole, arguments) };


module.exports = Role;
