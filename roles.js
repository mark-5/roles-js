var _ = require('underscore');
var HashOfRefs = require('./hash_of_refs.js');

var INHERITS_FROM = function(subclass, superclass){
    var Surrogate = function(){};
    Surrogate.prototype = subclass.prototype;
    return (new Surrogate) instanceof superclass;
};

var EXTEND_CLASS = function(mapping){
    var klass = this;
    var child = function(){ return klass.apply(this, arguments) };
    _.extend(child, klass);
    var Surrogate = function(){ this.constructor = child };
    Surrogate.prototype = klass.prototype;
    child.prototype = new Surrogate;
    _.extend(child.prototype, mapping);
    return child;
};

var METHOD_MODIFIERS = ['before', 'after', 'around'];
var MetaRole = new function(){
    this._applications = new HashOfRefs;

    this.is_role = function(role) { return role instanceof Role };
    this.does_role = function(klass, role) {
        if (this.is_role(klass)) {
            return _.contains(klass.applied(), role);
        } else {
            var applied_to = this._applications.get(role);
            return _.some(applied_to, function(consumer){
                return    klass === consumer
                       || klass instanceof consumer
                       || INHERITS_FROM(klass, consumer);
            });
        }
    };
    this.apply_roles = function(klass){
        var me = this;
        var roles = _.rest(arguments);
        var conflicts = this._get_conflicts(roles);
        if (_.size(conflicts)) {
            var methods = _.keys(conflicts).join(',');
            throw "Conflicting methods: " + methods;
        }
        var required  = _.flatten(_.map(roles, function(role){ return role.requires() }), true);
        var provided  = _.extend.apply(_, _.map(roles, function(role){ return role.provides() }));
        var missing   = this._get_missing(klass, provided, required);
        if (_.size(missing)) {
            var methods = missing.join(',');
            throw "Missing methods: " + methods;
        }

        var klass_with_role = EXTEND_CLASS.call(klass, provided);
        this._install_modifiers(klass_with_role, _.map(roles, function(role){ return role.modifiers() }));

        var roles_applied = roles.concat(_.chain(roles).map(function(role){ return role.applied() }).flatten(true).value());
        _.each(_.uniq(roles_applied), function(role){
            var applied_to = me._applications.get(role);
            if (!applied_to) applied_to = [], me._applications.set(role, applied_to);
            applied_to.push(klass_with_role)
        });

        return klass_with_role;
    };
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
            _.each(METHOD_MODIFIERS, function(type){
                var methods = modifier[type];
                _.each(methods, function(coderefs, name){
                    if (!modifier_data[name]) modifier_data[name] = {wrapped: klass.prototype[name]};
                    if (type == 'before') {
                        if (!modifier_data[name].before) modifier_data[name].before = [];
                        coderefs = _.clone(coderefs).reverse();
                        // modifiers are sorted from lowest priority to highest(to mimic role application priorities)
                        //  reverse so highest priority coderefs are executed first
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
                var retval = modifiers.wrapped.apply(me, args);
                _.each(modifiers.after||[], function(code){ code.apply(me, args) });
                return retval;
            };
        });
    };
};

var Role = function(members, opts){
    var me = this;
    this.members = _.clone(members || {});
    this.opts = _.clone(opts || {});
    _.each(['with','requires'], function(key){
        var val = me.opts[key];
        if (!val) me.opts[key] = val = [];
        if (!_.isArray(val)) me.opts[key] = [val];
    });
    var conflicts = this.meta._get_conflicts(this.opts.with);
    if (_.size(conflicts)) {
        var methods = _.keys(conflicts).join(',');
        throw "Conflicting methods: " + methods;
    }

    this.freeze();
    return this;
};
Role.prototype = new function(){
    this.meta = MetaRole;
    this.requires = function(){
        var applied = this.opts.with;
        var from_opts = this.opts.requires;
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
        var required = _.flatten([from_opts, from_applied, from_modifiers], true);
        return _.difference(required, this.provides());
    };
    this.provides = function(){
        var provided = this.members;
        var from_applied = _.extend.apply(_,
            _.map(this.opts.with, function(role){ return role.provides() })
        );
        return _.extend({}, provided, from_applied);
    };
    this.modifiers = function(){
        var opts = this.opts;
        var modifiers = {};
    
        _.each(METHOD_MODIFIERS, function(type){
            modifiers[type] = {};
            var from_opts = _.clone(opts[type] || {});
            _.each(from_opts, function(val, key){ if (!_.isArray(from_opts[key])) from_opts[key] = [val] });
            var from_applied = _.map(opts.with, function(role){ return role.modifiers()[type] || {} });
            var methods_modified = _.chain([from_applied, from_opts])
                                    .flatten(true)
                                    .map(function(mod){ return _.keys(mod) })
                                    .flatten(true)
                                    .uniq()
                                    .value();
            _.each(methods_modified, function(method_name){
                // modifiers are sorted from least to highest priority
                //  make sure the original code refs have highest priority
                modifiers[type][method_name]  = _.chain([from_applied, from_opts])
                                                 .flatten(true)
                                                 .map(function(mod){ return mod[method_name] || [] })
                                                 .flatten(true)
                                                 .value();
            });
        });

        return modifiers;
    };
    this.applied = function(){
        var roles_applied = [this];
        _.each(this.opts.with, function(role){
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

global.Role = module.exports = Role;
