# Roles.js

Roles.js is a javscript library for [Role::Tiny](https://metacpan.org/pod/Role::Tiny) inspired traits. This includes support for providing methods, requiring methods, detecting conflicting methods, and installing method modifiers.

```
    var HasFoo = new Role({
        get_foo: function(){ ... },
    }, {
        after: {initialize: function(){ ... }},
        before: {render: function(){ ... }}
    });
    var View = Backbone.View.extend({ ... });
    var ViewWithFoo = Role.apply_roles(View, HasFoo);
```

## Class Methods

### new(methods, modifiers)

The constructor to instantiate roles.

```
var MyRole = new Role({my_method: function(){ ... }}, {with: AnotherRole});
```

#### methods

An object containing methods the role provides.

#### modifiers

This is an object containing Role::Tiny keywords - with, requires, before, around, after. with and requires can be keyed to either a single role/method name, or an array of roles/methods. Method modifiers are objects with method name keys, and modifier code values.

```
{
    with: [Roles...],
    requires: [method_names...],
    before: {method: function(){ ... } },
    around: {method: function(original, arg1, arg2) { ... original.call(this, arg1, arg2) ... }},
    after: {method: function(){ ... }},
}
```

### apply_roles(Class, ...)

The main entry point to Roles.js. Returns a copy of the given class, with the specified roles applied.

```
var ClassWithRoles = Role.apply_roles(Class, FirstRole, SecondRole);
```

### is_role(MaybeRole)


### does_role(RoleOrClass)


