// GENERATED FILE — do not edit by hand.
// Source: contracts/out/<Contract>.sol/<Contract>.json (`forge build`)
// Regenerate with: npm run abis

export const edGrantLensAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "registry_",
        "type": "address",
        "internalType": "contract VerifiedEntityRegistry"
      },
      {
        "name": "vault_",
        "type": "address",
        "internalType": "contract EducationFundingVault"
      },
      {
        "name": "profiles_",
        "type": "address",
        "internalType": "contract SchoolProfile"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "directory",
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
        "type": "tuple[]",
        "internalType": "struct EdGrantLens.SchoolOverview[]",
        "components": [
          {
            "name": "school",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "verified",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "entityName",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "proofURI",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "entityType",
            "type": "uint8",
            "internalType": "enum IVerifiedEntityRegistry.EntityType"
          },
          {
            "name": "verifiedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "profile",
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
          },
          {
            "name": "stats",
            "type": "tuple",
            "internalType": "struct EdGrantLens.SchoolStats",
            "components": [
              {
                "name": "totalRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "openRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "disbursedRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "releasableRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "expiredRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "totalRequested",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "totalHeld",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "totalDisbursed",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "openRequests",
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
        "type": "tuple[]",
        "internalType": "struct EdGrantLens.RequestView[]",
        "components": [
          {
            "name": "requestId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "request",
            "type": "tuple",
            "internalType": "struct EducationFundingVault.FundingRequest",
            "components": [
              {
                "name": "school",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "studentRef",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "goal",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "raised",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "createdAt",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "deadline",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "disbursed",
                "type": "bool",
                "internalType": "bool"
              }
            ]
          },
          {
            "name": "context",
            "type": "tuple",
            "internalType": "struct EducationFundingVault.StudentContext",
            "components": [
              {
                "name": "pseudonym",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "statement",
                "type": "string",
                "internalType": "string"
              }
            ]
          },
          {
            "name": "remaining",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "releasable",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "refundable",
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
    "name": "openRequestsOf",
    "inputs": [
      {
        "name": "school",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "page",
        "type": "tuple[]",
        "internalType": "struct EdGrantLens.RequestView[]",
        "components": [
          {
            "name": "requestId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "request",
            "type": "tuple",
            "internalType": "struct EducationFundingVault.FundingRequest",
            "components": [
              {
                "name": "school",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "studentRef",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "goal",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "raised",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "createdAt",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "deadline",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "disbursed",
                "type": "bool",
                "internalType": "bool"
              }
            ]
          },
          {
            "name": "context",
            "type": "tuple",
            "internalType": "struct EducationFundingVault.StudentContext",
            "components": [
              {
                "name": "pseudonym",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "statement",
                "type": "string",
                "internalType": "string"
              }
            ]
          },
          {
            "name": "remaining",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "releasable",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "refundable",
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
    "name": "profiles",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract SchoolProfile"
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
        "internalType": "contract VerifiedEntityRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "requestsOf",
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
      }
    ],
    "outputs": [
      {
        "name": "page",
        "type": "tuple[]",
        "internalType": "struct EdGrantLens.RequestView[]",
        "components": [
          {
            "name": "requestId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "request",
            "type": "tuple",
            "internalType": "struct EducationFundingVault.FundingRequest",
            "components": [
              {
                "name": "school",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "studentRef",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "goal",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "raised",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "createdAt",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "deadline",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "disbursed",
                "type": "bool",
                "internalType": "bool"
              }
            ]
          },
          {
            "name": "context",
            "type": "tuple",
            "internalType": "struct EducationFundingVault.StudentContext",
            "components": [
              {
                "name": "pseudonym",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "statement",
                "type": "string",
                "internalType": "string"
              }
            ]
          },
          {
            "name": "remaining",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "releasable",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "refundable",
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
    "name": "schoolOverview",
    "inputs": [
      {
        "name": "school",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "overview",
        "type": "tuple",
        "internalType": "struct EdGrantLens.SchoolOverview",
        "components": [
          {
            "name": "school",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "verified",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "entityName",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "proofURI",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "entityType",
            "type": "uint8",
            "internalType": "enum IVerifiedEntityRegistry.EntityType"
          },
          {
            "name": "verifiedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "profile",
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
          },
          {
            "name": "stats",
            "type": "tuple",
            "internalType": "struct EdGrantLens.SchoolStats",
            "components": [
              {
                "name": "totalRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "openRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "disbursedRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "releasableRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "expiredRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "totalRequested",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "totalHeld",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "totalDisbursed",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "schoolPage",
    "inputs": [
      {
        "name": "school",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "postLimit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "overview",
        "type": "tuple",
        "internalType": "struct EdGrantLens.SchoolOverview",
        "components": [
          {
            "name": "school",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "verified",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "entityName",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "proofURI",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "entityType",
            "type": "uint8",
            "internalType": "enum IVerifiedEntityRegistry.EntityType"
          },
          {
            "name": "verifiedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "profile",
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
          },
          {
            "name": "stats",
            "type": "tuple",
            "internalType": "struct EdGrantLens.SchoolStats",
            "components": [
              {
                "name": "totalRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "openRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "disbursedRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "releasableRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "expiredRequests",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "totalRequested",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "totalHeld",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "totalDisbursed",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          }
        ]
      },
      {
        "name": "open",
        "type": "tuple[]",
        "internalType": "struct EdGrantLens.RequestView[]",
        "components": [
          {
            "name": "requestId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "request",
            "type": "tuple",
            "internalType": "struct EducationFundingVault.FundingRequest",
            "components": [
              {
                "name": "school",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "studentRef",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "goal",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "raised",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "createdAt",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "deadline",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "disbursed",
                "type": "bool",
                "internalType": "bool"
              }
            ]
          },
          {
            "name": "context",
            "type": "tuple",
            "internalType": "struct EducationFundingVault.StudentContext",
            "components": [
              {
                "name": "pseudonym",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "statement",
                "type": "string",
                "internalType": "string"
              }
            ]
          },
          {
            "name": "remaining",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "releasable",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "refundable",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      },
      {
        "name": "posts",
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
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "schoolStats",
    "inputs": [
      {
        "name": "school",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "stats",
        "type": "tuple",
        "internalType": "struct EdGrantLens.SchoolStats",
        "components": [
          {
            "name": "totalRequests",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "openRequests",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "disbursedRequests",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "releasableRequests",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "expiredRequests",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "totalRequested",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "totalHeld",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "totalDisbursed",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "vault",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract EducationFundingVault"
      }
    ],
    "stateMutability": "view"
  }
] as const;
