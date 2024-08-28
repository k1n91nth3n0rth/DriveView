# 🔒 File Encryptor & Decryptor

### Are you skeptical about big brother (governments) having backdoor access to your Google Drive? 🛡️ Worry not, encrypt your data before uploading and keep your secrets safe!

### Check out the fully functional version of this app deployed [here](https://musabnaik.com/Encrypted-Drive/). 

## Introduction
Welcome to the File Encryptor & Decryptor project! This nifty React app allows you to encrypt your files with a password before uploading them to your Google Drive, ensuring that only you and those with the password can access your precious data. Whether it's PDFs, Word documents, images, or even text files, we've got you covered. Best of all, all encryption and decryption processes occur locally on your machine—no backend server involved. This means that your unencrypted data and password never leave your machine, providing you with an extra layer of privacy and security. Keep your files safe and secure with our local encryption solution.

## Features
- **Encrypt Files**: Secure your files by encrypting them with a password.
- **Decrypt Files**: Easily decrypt your files using the correct password.
- **Supports Multiple File Types**: PDF, Word documents, images, text files, you name it.
- **User-Friendly Interface**: Simple and intuitive interface that anyone can use.

## Installation
1. Clone the repo
   ```bash
   git clone https://github.com/yourusername/file-encryptor.git
   cd file-encryptor

2. Install dependencies
	 ```bash
	 npm install

3. Start the development server
	 ```bash
	 npm start

4. Open your browser and navigate to `http://localhost:3000`.

## Usage

1.  **Encrypting a File**:
    
    -   Select a file you want to encrypt.
    -   Enter a password.
    -   The encrypted file will be automatically uploaded to your Google Drive.
2.  **Decrypting a File**:
    
    -   Select an encrypted file.
    -   Enter the password used for encryption.
    -   The decrypted file will be automatically downloaded with its original extension.

## Code Structure

-   `src/components/FileUploader.js`: Component for encrypting files.
-   `src/components/FileDecryptor.js`: Component for decrypting files.
-   `src/App.js`: Main application component combining FileUploader and FileDecryptor.

## Encryption Details

-   Uses **AES (Advanced Encryption Standard)** for strong encryption.
-   Prepend the MIME type of the original file in the encrypted content to ensure correct file type handling during decryption.

## Future Enhancements

-   **Multiple File Encryption/Decryption**: Batch processing of files.
-   **Enhanced Security Features**: Adding more encryption algorithms and security layers.

## Contributing

Feel free to submit issues and enhancement requests and customize it further based on your preferences.

## License

This project is licensed under the MIT License.

## Final Note

Remember, keeping your data safe is your responsibility. Encrypting your files before uploading them to the cloud is a good practice to ensure your privacy in this ever-surveilling world. Stay safe, stay private!