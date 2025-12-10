export class BaseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class NetworkError extends BaseError {
    constructor(message: string = 'Network error occurred') {
        super(message);
    }
}

export class TimeoutError extends BaseError {
    constructor(message: string = 'Operation timed out') {
        super(message);
    }
}

export class UnauthorizedError extends BaseError {
    constructor(message: string = 'Unauthorized access') {
        super(message);
    }
}

export class NotFoundError extends BaseError {
    constructor(message: string = 'Resource not found') {
        super(message);
    }
}

export class CryptoError extends BaseError {
    constructor(message: string = 'Decryption failed') {
        super(message);
    }
}
