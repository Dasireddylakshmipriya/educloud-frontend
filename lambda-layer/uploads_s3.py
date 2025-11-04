import boto3
from botocore.exceptions import NoCredentialsError, ClientError

def upload_file_to_s3(file_name, bucket, object_name=None):
    # If S3 object_name not specified, use file_name
    if object_name is None:
        object_name = file_name

    # Create S3 client
    s3_client = boto3.client('s3')

    try:
        response = s3_client.upload_file(file_name, bucket, object_name)
    except FileNotFoundError:
        print(f"File {file_name} not found.")
        return False
    except NoCredentialsError:
        print("AWS credentials not found or invalid.")
        return False
    except ClientError as e:
        print(f"Failed to upload: {e}")
        return False
    print(f"File uploaded successfully to s3://{bucket}/{object_name}")
    return True

if __name__ == "__main__":
    file_name = 'python-pptx-layer.zip'
    bucket_name = 'educloudfrontend2bf38c8bc5dc4051a5746eb0aace1a63c289-cleanenv'
    upload_file_to_s3(file_name, bucket_name)
