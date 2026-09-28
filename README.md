# PlayMarket – User Panel (Fixed)

Single clean User panel. Deploy **this folder only**.

## Why data was not loading

1. Queries did **not** include `where("isPublished", "==", true)`.
2. Firestore rules only allow reading documents where `isPublished == true`.
3. Result → **Missing or insufficient permissions** → empty screen.

This is now fixed. Every list query forces `isPublished == true` and has fallbacks if composite indexes are missing.

## Deploy this folder

```
User/
├── index.html
├── css/
│   ├── style.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── firebase.js          ← your config is already here
│   ├── firestore.js         ← FIXED
│   ├── auth.js
│   ├── router.js
│   ├── home.js
│   ├── search.js
│   ├── app-details.js
│   ├── favorites.js
│   ├── profile.js
│   ├── reviews.js
│   └── utils.js
├── firestore.rules
└── README.md
```

### Local test
```bash
cd User
npx serve .
# or: python3 -m http.server 8080
```

### Firebase Hosting
```bash
firebase init hosting   # public = this User folder
firebase deploy
```

## Required in Firestore for apps to show

Each app document **must** have:

```js
isPublished: true
```

Optional but recommended fields:
- `type`: `"app"` | `"game"` | `"movie"` | `"book"` | `"kids"`
- `name`, `nameLower`, `developer`, `iconUrl` / `icon`
- `downloadUrl`
- `isFeatured`, `isPopular`, `isNew`
- `downloadCount`, `rating`, `category`
- `searchKeywords` (array of strings)

If Admin only set `status: "published"` and never `isPublished: true`, the app will **not** appear (rules block it). Fix those documents in Firebase Console or from Admin after rules are updated.

## Indexes

When the browser console shows an index error, click the link Firebase gives you and create the index. Common ones:

- `isPublished` ASC + `type` ASC + `downloadCount` DESC
- `isPublished` ASC + `isFeatured` ASC + `downloadCount` DESC
- `isPublished` ASC + `nameLower` ASC
- `isPublished` ASC + `searchKeywords` ARRAY_CONTAINS + `downloadCount` DESC
