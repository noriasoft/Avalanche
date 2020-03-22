# Standards

## HTTP Responses

Each controller should generally support at least these 5 requests:

- `GET      /*/index`
- `GET      /*/show`
- `POST     /*/store`
- `PUT      /*/update`
- `DELETE   /*/destroy`

Ofcourse there are scenarios where not all 5 are needed.
But generally in the context of an entity like '*Item*', '*Post*' or '*Team*'.

---

## Controller handlers

At the top of each controller handler you should have an `onSuccess` function and an `onFailure` function.

The `onSuccess` should be called when your handler is able to serve what it was asked to serve.
```
const onSuccess = ({ results }) => {
  response.json({
    success: true,
    data: results
  });
};
```
The `onFailure` should be called when your handler is unable to serve what it was asked to serve.
```
const onFailure = ({ message, errors }) => {
  response.json({
    success: false,
    message: message || "Unable to fetch records.",
    errors: errors
  });
}
```

## Errors

These are errors you should implement in your application:

- `databaseError`
- `accessDenied`
- `illegalOperation`

Ofcourse if none of these fit your use-case you should add custom errors.

# Examples

## HTTP Responses

This is how these responses should be generally formatted:

`GET /*/index`

Successful response:
```
    {
        success: true,
        data: [
            {
                ID: 123,
                code: "ABC",
                description: "Multiple records must be encapsulated in an array",
                createdAt: 1570744800,
                updatedAt: null
            },
            {
                ID: 124,
                code: "ABD",
                description: "Example record 2.",
                createdAt: 1570744801,
                updatedAt: null
            }
        ]
    }
```

`GET /*/show`

Successful response:
```
    {
        success: true,
        data: {
            ID: 125,
            code: "ABE",
            description: "Single record that is not encapsulated in an array",
            createdAt: 1570744802,
            updatedAt: null
        }
    }
```
Failed response:

```
    {
        success: false,
        message: "Unable to fetch Record",
        errors: [
            {
                error: "accessDenied",
                message: "Access denied"
            }
        ]
    }
```

`POST /*/store`

Successful response:
```
    {
        success: true,
        message: "Record was saved!"
    }
```

Failed response:
```
    {
        success: false,
        message: "Unable to save Record!",
        errors: [
            {
                error: "databaseError",
                message: "Database error"
            }
        ]
    }
```

## Regular entity setup:

`class Post extends AFModel {}`

`class PostController extends AFController {}`

*Routes:*

`GET /post/index` // Used to display all posts

`GET /post/show` // Used to display a specific post

`POST /post/create` // Used to create a post

`PUT /post/update` // Used to update a post

`DELETE /post/destroy` // Used delete a post

## Exceptional entity setup:

`class User extends AFModel {}`

`class UserController extends AFController {}`

*Routes:*

`GET /user/show` // Used to display another user's profile

`GET /user/profile` // Used to display the user's own profile

`POST /user/login` // Used to log a user in

`POST /user/register` // Used to create a user account

`PUT /user/forget` // Used to set the account to be deleted after 15 days