import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings


def get_s3_client():
    scheme = "https" if settings.minio_use_ssl else "http"
    return boto3.client(
        "s3",
        endpoint_url=f"{scheme}://{settings.minio_endpoint}",
        aws_access_key_id=settings.minio_root_user,
        aws_secret_access_key=settings.minio_root_password,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
    )


def ensure_bucket() -> None:
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=settings.minio_bucket)
    except ClientError:
        client.create_bucket(Bucket=settings.minio_bucket)


def upload_bytes(key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    client = get_s3_client()
    client.put_object(Bucket=settings.minio_bucket, Key=key, Body=data, ContentType=content_type)


def get_object_bytes(key: str) -> bytes:
    client = get_s3_client()
    response = client.get_object(Bucket=settings.minio_bucket, Key=key)
    return response["Body"].read()


def generate_presigned_upload_url(key: str, expires_in: int = 3600) -> str:
    client = get_s3_client()
    return client.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.minio_bucket, "Key": key},
        ExpiresIn=expires_in,
    )


def generate_presigned_download_url(key: str, expires_in: int = 3600) -> str:
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.minio_bucket, "Key": key},
        ExpiresIn=expires_in,
    )
