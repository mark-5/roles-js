var Role   = require("../roles.js");
var assert = require('assert');
var _      = require('underscore');

describe('Role', function(){
    describe('static methods', function(){
        it('is_role', function(){
            var role = new Role({});
            var func = function(){};
            var instance = new func;
            var object = {};

            assert.ok(Role.is_role(role), 'role is role');
            assert.ok(!Role.is_role(func), 'function is not role');
            assert.ok(!Role.is_role(instance), 'class instance is not role');
            assert.ok(!Role.is_role(object), 'object is not role');
        });
        it('does_role', function(){
            var Class = function(){};
            var AppliedRole = new Role({foo: function(){}});
            var ForeignRole = new Role({bar: function(){}});
            var ClassWithRoles = Role.apply_roles(Class, AppliedRole);
            var instance = new ClassWithRoles;

            assert.ok(Role.does_role(AppliedRole, AppliedRole), 'role does itself');
            assert.ok(!Role.does_role(AppliedRole, ForeignRole), 'role doesnt do foreign role');
            assert.ok(Role.does_role(ClassWithRoles, AppliedRole), 'applied class does role');
            assert.ok(!Role.does_role(ClassWithRoles, ForeignRole), 'applied class doesnt do foreign role');
            assert.ok(Role.does_role(instance, AppliedRole), 'applied class instance does role');
            assert.ok(!Role.does_role(instance, ForeignRole), 'applied class instance doesnt do foreign role');
        });
        it('apply_roles', function(){
            var FirstRole  = new Role({first:  function(){}});
            var WithFirst = Role.apply_roles(function(){}, FirstRole);

            var first_instance = new WithFirst;
            assert.ok(Role.does_role(WithFirst, FirstRole), 'class with role does role');
            assert.ok(Role.does_role(first_instance, FirstRole), 'class instance with role does role'),
            assert.ok(_.isFunction(first_instance.first), 'class instance has method from role');

            var SecondRole = new Role({second: function(){}});
            var roles = [FirstRole, SecondRole];
            var methods = ['first', 'second'];
            var WithBoth = Role.apply_roles(function(){}, FirstRole, SecondRole);
            var multirole_instance = new WithBoth;
            assert.ok(
                _.every(roles, function(role){ return Role.does_role(WithBoth, role) }),
                'class does multiple roles'
            );
            assert.ok(
                _.every(roles, function(role){ return Role.does_role(multirole_instance, role) }),
                'class instance does multiple roles'
            );
            assert.ok(
                _.every(methods, function(method){ return multirole_instance[method] }),
                'class instance has methods from multiple roles'
            );
        });
    });
    describe('role application', function(){
        it('with', function(){
            var FirstRole = new Role({foo: function(){}});
            var RoleWith = new Role({with: [FirstRole], bar: function(){}});
            var Class = Role.apply_roles(function(){}, RoleWith);
            var o = new Class;
            assert.ok(o.bar, 'object has method from role');
            assert.ok(o.foo, 'object has method from applied roles in role');
        });
        it('requires', function(){
            var RequiresFoo = new Role({requires: ['foo']});
            assert.throws(
                function(){ Role.apply_roles(function(){}, RequiresFoo) },
                'missing required throws an error'
            );
            var DoesFoo = new Role({foo: function(){}});
            assert.doesNotThrow(
                function(){ Role.apply_roles(function(){}, RequiresFoo, DoesFoo) },
                'applied role for required method'
            );
            var FooClass = function(){}; FooClass.prototype.foo = function(){};
            assert.doesNotThrow(
                function(){ Role.apply_roles(FooClass, RequiresFoo) },
                'applied role to class implementing required method'
            );
            var DoesRequirement = new Role({requires: ['foo'], foo: function(){}});
            assert.doesNotThrow(
                function(){ Role.apply_roles(function(){}, DoesRequirement) },
                'applied role which does its own requires'
            );
            var WithRequirement = new Role({requires: ['foo'], with: [DoesFoo]});
            assert.doesNotThrow(
                function(){ Role.apply_roles(function(){}, WithRequirement) },
                'applied role which applies its own required method'
            ); 
            assert.doesNotThrow(
                function(){ new Role({with: [RequiresFoo]}) },
                'role can be composed with missing requirements'
            );
        });
        it('conflicts', function(){
            var DoesFoo = new Role({foo: function(){}});
            var AlsoDoesFoo = new Role({foo: function(){}});
            assert.throws(
                function(){ Role.apply_roles(function(){}, DoesFoo, AlsoDoesFoo) },
                /conflict.*foo/i,
                'conflict applying duplicate methods to class'
            );
            assert.throws(
                function(){ new Role({with: [DoesFoo, AlsoDoesFoo]}) },
                /conflict.*foo/i,
                'conflict applying duplicate methods to role'
            );
        });
    });
    describe('modifiers', function(){
        it('before', function(){
            var events = [];
            var BeforeFoo = new Role({before: {foo: function(){ events.push('before') }}});
            assert.deepEqual(BeforeFoo.requires(), ['foo'], 'modifier requires modified method');

            var Class = function(){}; Class.prototype = {foo: function(){ events.push('called') }};
            var Modified = Role.apply_roles(Class, BeforeFoo);
            var o = new Modified; o.foo();
            assert.deepEqual(events, ['before','called'], 'before modifier called before');
        });
        it('after', function(){
            var events = [];
            var AfterFoo = new Role({after: {foo: function(){ events.push('after') }}});
            assert.deepEqual(AfterFoo.requires(), ['foo'], 'modifier requires modified method');

            var Class = function(){}; Class.prototype = {foo: function(){ events.push('called') }};
            var Modified = Role.apply_roles(Class, AfterFoo);
            var o = new Modified; o.foo();
            assert.deepEqual(events, ['called','after'], 'after modifier called after');
        });
        it('around', function(){
            var events = [];
            var notify_around = function(method){
                events.push('before');
                method.apply(this, _.rest(arguments));
                events.push('after');
            };
            var AroundFoo = new Role({around: {foo: notify_around}});
            assert.deepEqual(AroundFoo.requires(), ['foo'], 'modifier requires modified method');

            var Class = function(){}; Class.prototype = {foo: function(){ events.push('called') }};
            var Modified = Role.apply_roles(Class, AroundFoo);
            var o = new Modified; o.foo();
            assert.deepEqual(events, ['before', 'called','after'], 'around modifier called around');
        });
        it('multiple modifiers in role', function(){
            var events = [];
            var Class = function(){}; Class.prototype = {foo: function(){ events.push('called') }};
            var Modifier = new Role({
                before: {foo: function(){ events.push('before') }},
                around: {foo: function(method){
                    events.push('before around');
                    method.call(this, _.rest(arguments));
                    events.push('after around');
                }},
                after: {foo: function(){ events.push('after') }},
            });
            var o = new(Role.apply_roles(Class, Modifier)); o.foo();
            assert.deepEqual(
                events,
                ['before','before around','called','after around','after'],
                'modifiers executed in order'
            );
        });
        it.skip('role has method modifiers in applied role', function(){
            var events = [];
            var Class = function(){}; Class.prototype = {foo: function(){ events.push('called') }};
        
        });
        it.skip('class applies multiple roles with method modifiers', function(){
            var events = [];
            var Class = function(){}; Class.prototype = {foo: function(){ events.push('called') }};
        });
    });
    describe('inheritance', function(){
        var Parent = function(){};
        var DoesFoo = new Role({foo: function(){}});
        Parent = Role.apply_roles(Parent, DoesFoo);
        var Child = function(){}; Child.prototype = new Parent;
        var c = new Child; var p = new Parent;
        it('does_role', function(){
            assert.ok(Role.does_role(c, DoesFoo), 'subclass does role of parent');
        });
        it('provided methods', function(){
            assert.equal(c.foo, p.foo, 'subclass inherits some role methods from parent');
        });
    });
});
