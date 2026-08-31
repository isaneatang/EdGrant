// GENERATED FILE — do not edit by hand.
// Source: contracts/out/<Contract>.sol/<Contract>.json (`forge build`)
// Regenerate with: npm run abis

export const schoolProfileAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "registry_",
        "type": "address",
        "internalType": "contract IVerifiedEntityRegistry"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "MAX_BODY",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_DESCRIPTION",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_SHORT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_TITLE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_URI",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPost",
    "inputs": [
      {
        "name": "school",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct SchoolProfile.Post",
        "components": [
          {
            "name": "title",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "body",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum SchoolProfile.PostKind"
          },
          {
            "name": "postedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "visible",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasProfile",
    "inputs": [
      {
        "name": "school",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "postCount",
    "inputs": [
      {
        "name": "school",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "profileOf",
    "inputs": [
      {
        "name": "school",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct SchoolProfile.Profile",
        "components": [
          {
            "name": "displayName",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "logoURI",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "bannerURI",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "description",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "website",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "location",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "updatedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "exists",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "profiledCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "profiledSchools",
    "inputs": [
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "page",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "publishPost",
    "inputs": [
      {
        "name": "kind",
        "type": "uint8",
        "internalType": "enum SchoolProfile.PostKind"
      },
      {
        "name": "title",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "body",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "postId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "recentPosts",
    "inputs": [
      {
        "name": "school",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "includeHidden",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [
      {
        "name": "page",
        "type": "tuple[]",
        "internalType": "struct SchoolProfile.Post[]",
        "components": [
          {
            "name": "title",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "body",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum SchoolProfile.PostKind"
          },
          {
            "name": "postedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "visible",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      },
      {
        "name": "postIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registry",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IVerifiedEntityRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setPostVisibility",
    "inputs": [
      {
        "name": "postId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "visible",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setProfile",
    "inputs": [
      {
        "name": "displayName",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "logoURI",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "bannerURI",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "description",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "website",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "location",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "PostPublished",
    "inputs": [
      {
        "name": "school",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "kind",
        "type": "uint8",
        "indexed": true,
        "internalType": "enum SchoolProfile.PostKind"
      },
      {
        "name": "title",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "postedAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PostVisibilityChanged",
    "inputs": [
      {
        "name": "school",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "visible",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProfileUpdated",
    "inputs": [
      {
        "name": "school",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "displayName",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "updatedAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "EmptyDisplayName",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EmptyTitle",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoProfile",
    "inputs": [
      {
        "name": "school",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "NotVerified",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "StringTooLong",
    "inputs": [
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "max",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "UnknownPost",
    "inputs": [
      {
        "name": "school",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;
