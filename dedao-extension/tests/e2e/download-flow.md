# End-to-End Test: Ebook Download Flow

**Goal**: Verify that a user can successfully download an ebook from Dedao.cn.

## Prerequisites
- Chrome browser with the extension installed (Load unpacked).
- Valid Dedao account with purchased ebooks.

## Steps

1. **Login**
   - Open https://www.dedao.cn in Chrome.
   - Log in to your account.

2. **Open Ebook**
   - Navigate to "My Ebooks" (电子书架).
   - Click on any purchased book to open the detail page or reading page.
   - URL should look like `https://www.dedao.cn/ebook/detail?id=...` or `.../reader?id=...`.

3. **Activate Extension**
   - Click the extension icon in the toolbar.
   - **Verify**: Popup opens. Title shows "Ready to download" or "Book Found".
   - **Verify**: "Download EPUB" button is enabled.

4. **Start Download**
   - Click "Download EPUB".
   - **Verify**:
     - Button becomes disabled/hidden.
     - Progress bar appears.
     - Status text updates (Fetching token -> Info -> Chapter X/N -> Generating).

5. **Completion**
   - Wait for progress to reach 100%.
   - **Verify**: Browser starts downloading a `.epub` file (e.g., `dedao_EID....epub`).
   - **Verify**: Popup shows "Download Completed!".

6. **Validate EPUB**
   - Open the downloaded EPUB in Calibre, Apple Books, or Edge.
   - **Check**:
     - Cover image is present.
     - Table of Contents (TOC) is correct and clickable.
     - Images in chapters are displayed.
     - Text is readable.

## Troubleshooting
- If "No book found": Refresh the page and try again.
- If "Unauthorized": Log out and log in again on Dedao.cn.
- If "Network Error": Check internet connection.
