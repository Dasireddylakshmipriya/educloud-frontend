import { AmplifyS3ResourceTemplate } from '@aws-amplify/cli-extensibility-helper';

export function override(resources: AmplifyS3ResourceTemplate) {
    const authReadPolicy = resources.s3AuthReadPolicy;

    if (authReadPolicy && authReadPolicy.policyDocument) {
        const policyDoc = authReadPolicy.policyDocument as any;
        
        // Initialize Statement array if it doesn't exist
        if (!policyDoc.Statement) {
            policyDoc.Statement = [];
        }

        // Remove old ListBucket statement if exists
        policyDoc.Statement = policyDoc.Statement.filter(
            (statement: any) => statement.Sid !== 'AllowListObjectsInBucket'
        );

        // Add correct ListBucket permissions
        policyDoc.Statement.push({
            Sid: 'AllowAuthListBucket',
            Effect: 'Allow',
            Action: ['s3:ListBucket'],
            Resource: [
                { 'Fn::Join': ['', ['arn:aws:s3:::', { Ref: 'S3Bucket' }]] }
            ],
            Condition: {
                StringLike: {
                    's3:prefix': [
                        'public/',
                        'public/*',
                        'protected/${cognito-identity.amazonaws.com:sub}/',
                        'protected/${cognito-identity.amazonaws.com:sub}/*',
                        'private/${cognito-identity.amazonaws.com:sub}/',
                        'private/${cognito-identity.amazonaws.com:sub}/*',
                        ''
                    ]
                }
            }
        });
    }
}
