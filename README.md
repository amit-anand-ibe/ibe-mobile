# IBE Mobile Application

A comprehensive mobile application built using **React Native** for managing employee workflows. The app includes key features such as **timesheet management**, **absence tracking**, **expense reporting**, and **approvals**, providing a streamlined experience for employees and managers alike. Designed with a focus on efficiency and usability, this application enables users to easily submit, monitor, and approve various work-related activities from their mobile devices.

## Key Features
- **Timesheet Management**: Log work hours, view detailed records, and track time for various projects and tasks.
- **Absence Tracking**: Request leaves, view leave balances, and track upcoming absences.
- **Expense Reporting**: Submit and manage expense claims, attach receipts, and track reimbursement statuses.
- **Approval Workflow**: Managers can review and approve or reject timesheets, absence requests, and expense reports directly from the app.
  
## Installation

1. **Clone the repository**:
   
   ```bash
   git clone https://github.com/yourusername/ibe-mobile.git
   
2. **Navigate into the project directory**:
   
   ```bash
   cd ibe-mobile

4. **Install dependencies**:
   
   Ensure you have Node.js and npm or yarn installed. Then, install the required project dependencies:
   ```bash
   npm install
   # OR
   yarn install
  
4. **Running the App**

   Once the server is running, you can launch the app on:
   
   ```bash
   npx expo start
   ```

  - **iOS**: Scan the QR code with the Expo Go app (available in the App Store).
  - **Android**: Scan the QR code with the Expo Go app (available in the Google Play Store) or use an Android emulator.
    
## Building the Application

To build the application for release using Expo, you can use **Expo's build service**.

### For iOS:

To build the iOS app, run the following command:
```bash
npx expo build:ios
```

This will guide you through the process of building the iOS app and generate a build that can be deployed to TestFlight.

### For Android:

```bash
npx expo build:android
```

This will generate an APK or AAB file that can be distributed to users or uploaded to the Google Play Store.

## Contributing

We welcome contributions to help improve the IBE Mobile Application! Here's how you can get involved:

## How to Contribute

1. **Fork the repository**:
   Start by forking the repository to your GitHub account:

   ```bash
   git clone https://github.com/yourusername/ibe-mobile.git
   ```

2. **Create a new branch**:
   Create a new branch for your feature or bug fix:

   ```bash
   git checkout -b feature/your-feature-name
   ```
   
3. **Make your changes**:
   Implement your changes in the newly created branch. Make sure to test your changes locally before committing.

4. **Commit your changes:**
   Commit your work with a clear message describing what you’ve done:

   ```bash
   git commit -m "Add your descriptive commit message here"
   ```
   
5. **Push to GitHub**:
   Push your changes to your GitHub fork:

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Submit a pull request**:
   Open a pull request on the original repository, detailing your changes, and request a review. Be sure to link any relevant issues if applicable.

## Contribution Guidelines

- **Style Guide**: Follow best practices and maintain consistency with the existing codebase.
- **Testing**: Ensure your changes are thoroughly tested before submitting a pull request.
- **Documentation**: If your change involves a new feature or updates to an existing one, make sure to update or add documentation where necessary.
- **Branch Naming**: Use meaningful branch names such as `feature/add-login` or `bugfix/fix-timesheet-calculation`.

## Reporting Issues

If you encounter any issues or bugs, feel free to [open an issue](https://github.com/yourusername/ibe-mobile/issues) on the repository. When reporting, please be sure to include:

- A clear title and description.
- Steps to reproduce the issue.
- Any relevant log files or screenshots.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

