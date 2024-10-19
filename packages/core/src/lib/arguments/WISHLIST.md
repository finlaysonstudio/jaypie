# Wishlist 🌠

## More Conveniences

``` javascript
validate.positive(argument);
validate.negative(argument);

validate.lowercase(argument);
validate.uppercase(argument);
```

## More Types

* Date

## Force Into Required Type

``` javascript
force.lowercase(argument);
```

## Object Paths

``` javascript
validate.path(object, { "id": String });
validate.path(object, { "attributes/count": Number });
```

## Object Schema

``` javascript
validate.schema(object, {
  "id": Number,
  "model": [String, undefined]
  "attributes": {
    "name": String
  }
});
```

## Regex

``` javascript
validate.regex(object, /^Taco$/);
```
