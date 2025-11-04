// In amplify/backend/storage/s3afdc0ba5/override.js

const { Fn } = require('aws-cdk-lib');

/**
 * Function to override the storage resource properties.
 * This script ensures the s3:ListBucket permission is correctly added to the Auth Policy
 * for authenticated users, which fixes the 403 Forbidden error when listing files.
 * @param {object} resources The Amplify resource stack (contains all CFN resources).
 */
function override(resources) {
  // Use lowercase 'resources' property which holds the CloudFormation Resources map
  const cfnResources = resources.resources;

  // 1. Find the Logical ID of the S3 Bucket resource
  let s3BucketLogicalId = '';
  for (const [logicalId, resource] of Object.entries(cfnResources)) {
    if (resource.type === 'AWS::S3::Bucket') {
      s3BucketLogicalId = logicalId;
      console.log(`Found S3 Bucket Logical ID: ${s3BucketLogicalId}`);
      break;
    }
  }

  if (!s3BucketLogicalId) {
    console.error('CRITICAL: Could not find S3 Bucket Logical ID. Cannot add ListBucket permission.');
    return;
  }

  // 2. Find the Logical ID of the Auth Policy attached to the Auth Role
  let policyResource = undefined;
  // Get the Auth Role name reference string from CloudFormation
  const authRoleName = Fn.ref('authRoleName').toString();

  for (const [logicalId, resource] of Object.entries(cfnResources)) {
    if (resource.type === 'AWS::IAM::Policy') {
      const properties = resource.properties; 

      // Check if attached to the Auth Role
      const rolesString = JSON.stringify(properties.Roles || []);
      if (rolesString.includes(authRoleName)) {
        
        // Check if this policy mentions the S3 Bucket
        const policyDocString = JSON.stringify(properties.PolicyDocument);
        if (
          policyDocString.includes(s3BucketLogicalId) ||
          policyDocString.includes('Ref": "S3Bucket')
        ) {
          policyResource = resource;
          console.log(`Found relevant Auth Role S3 Policy Logical ID: ${logicalId}`);
          break; 
        }
      }
    }
  }

  if (!policyResource) {
    console.error('CRITICAL: Could not find S3 Auth Policy to update.');
    return;
  }

  // 3. Force-add the s3:ListBucket permission to the Auth Policy
  const bucketArn = Fn.join('', ['arn:aws:s3:::', Fn.ref(s3BucketLogicalId)]);

  // Statement required for ListBucket permission
  const listBucketStatement = {
    Effect: 'Allow',
    Action: ['s3:ListBucket'],
    Resource: [bucketArn], // The bucket ARN itself (required for ListBucket)
    Condition: {
      StringLike: {
        // Allows listing only in protected and public prefixes
        's3:prefix': [
          'protected/${cognito-identity.amazonaws.com:sub}/*',
          'public/*',
        ],
      },
    },
  };

  // Push the new statement into the existing policy document
  const policyDocument = policyResource.properties.PolicyDocument;
  policyDocument.Statement.push(listBucketStatement);

  console.log('Successfully added s3:ListBucket permission via override.');
}

module.exp
orts = { override };
