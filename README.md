# IBE Mobile Application

![Expo](https://img.shields.io/badge/Expo-managed-blue)
![Platform](https://img.shields.io/badge/platform-android%20%7C%20ios-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

A comprehensive mobile application built using **React native** for managing employee workflows. The app includes key features such as **timesheet management**, **absence tracking**, **expense reporting**, and **approvals**, providing a streamlined experience for employees and managers alike. Designed with a focus on efficiency and usability, this application enables users to easily submit, monitor, and approve various work-related activities from their mobile devices.

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [Folder Structure](#folder-structure)
- [Contributing](#contributing)
- [License](#license)

## Key Features

- **Timesheet Management**: Log work hours, view detailed records, and track time for various projects and tasks.
- **Absence Tracking**: Request leaves, view leave balances, and track upcoming absences.
- **Expense Reporting**: Submit and manage expense claims, attach receipts, and track reimbursement statuses.
- **Approval Workflow**: Managers can review and approve or reject timesheets, absence requests, and expense reports directly from the app.

## Prerequisites

Before you begin, ensure you have the following tools installed:

1. **Node.js**: The latest LTS version of Node.js is recommended. Download it from [here](https://nodejs.org/).
2. **npm or Yarn**: You can use either **npm** (comes with Node.js) or **Yarn** to manage project dependencies.
   - To install Yarn, you can run:
     ```bash
     npm install --global yarn
     ```

3. **Expo CLI**: The Expo command-line interface is required to run the app. Install it globally with:

   ```bash
   npm install --global expo-cli
   ```

4. **Expo Go App**: Install the **Expo Go** app on your mobile device to preview the app during development:
   - [iOS](https://apps.apple.com/app/expo-go/id982107779)
   - [Android](https://play.google.com/store/apps/details?id=host.exp.exponent&hl=en&gl=US)

### Optional (for advanced development):

5. **Android Studio**: If you want to run the app on an Android emulator or need advanced Android development features, you can install Android Studio with the Android SDK.
   - Download from [here](https://developer.android.com/studio).
6. **Xcode (macOS only)**: Required for running iOS simulators or building standalone iOS apps. Xcode can be downloaded from the App Store (macOS only).

## Tech Stack

- [**Expo**](https://expo.dev/): Framework for building cross-platform applications.
- [**React Native**](https://reactnative.dev/): Main framework for mobile UI.
- **Internal APIs**: Private to the IBE ecosystem. Contact the maintainers for access credentials or mock setup instructions. These APIs handle core functionalities such as authentication, data processing, and workflow integration (e.g., `app.ibe.net/endpoint`).

## Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/ibedotnet/ibe-mobile.git

   ```

2. **Navigate into the project directory**:

   ```bash
   cd ibe-mobile

   ```

3. **Running the App**

   Once the server is running, you can launch the app on:

   ```bash
   npx expo start
   ```

- **iOS**: Scan the QR code with the Expo Go app (available in the App Store).
- **Android**: Scan the QR code with the Expo Go app (available in the Google Play Store) or use an Android emulator.

## Running the App

Once you have the application set up and dependencies installed, you can run the app in development mode. Here’s how:

1. **Start the Development Server**:  
   Open a terminal in your project directory and run:

   ```bash
   npx expo start
   ```

   This command will start the Expo development server, and you will see a QR code in the terminal or in your browser.

2. **Open in Expo Go**:
   - **iOS**: Open the Expo Go app on your iPhone, and scan the QR code to preview the application.
   - **Android**: Open the Expo Go app on your Android device, or use an Android emulator, and scan the QR code.

3. **Development Tools**:  
   The Expo CLI also provides a web-based interface where you can:
   - Run the app in a web browser.
   - Access logs and error messages.
   - Use debugging tools.

4. **Hot Reloading**:  
   While developing, you can take advantage of hot reloading. If you make changes to your code, the app will automatically reload, allowing you to see updates in real-time without restarting the entire app.

5. **Running on Emulators**:
   - **Android**: If you have Android Studio set up, you can run the app on an emulator directly from the Expo CLI. Select the option for Android emulator from the web interface.
   - **iOS**: If you are on macOS and have Xcode installed, you can run the app in an iOS simulator by selecting the appropriate option in the Expo CLI interface.

## Building the Application

Builds are created with EAS Build profiles. Do not edit `src/constants.js` to switch environments.

Testing / QA build:

```bash
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

Production build:

```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```

For environment mapping, versioning, and store upload notes, see [Build and Release Notes](./docs/build-and-release.md).

## Folder Structure

```
ibe-mobile
├── android/                # Native Android code
├── src/                    # Main application source code
│   ├── assets/            # Images, fonts, sounds
│   ├── components/        # Reusable UI components
│   ├── screens/           # App screens (Login, Home, etc.)
│   ├── navigation/        # Navigation stack
│   ├── utils/             # Helper/utility functions
│   ├── theme/             # Theming and styles
│   ├── hooks/             # Custom hooks
│   ├── i18n/              # Localization
│   └── config/            # App-level config overrides
├── context/                # React context providers
├── __tests__/              # Unit and integration tests
├── docs/                   # Developer documentation
├── App.js                  # Entry point
├── app.json                # Expo config
├── README.md
└── package.json

```

### Project Directory: ibe-mobile

### Root Directory

- **__tests__/**: Contains test files and mocks for unit testing.
- **android/**: Android native code and Gradle configuration.
- **context/**: React context providers for managing shared state.
- **docs/**: Developer guides and documentation.
- **src/**: Main application source code.
- **node_modules/**: Auto-generated folder with project dependencies.
- **.expo/**: Expo-specific configuration files.
- **%ProgramData%/**: (Unusual) Possibly added by mistake — consider removing.

---

### `src/` Directory

- **assets/**: Images, icons, fonts, and other static resources.
- **components/**: Reusable UI components.
- **hooks/**: Custom React hooks.
- **locales/**: JSON files for internationalization (i18n).
- **navigation/**: Screen stack and navigation logic.
- **screens/**: Core application screens (e.g., Login, Home, Timesheet).
- **styles/**: Global and shared style definitions.
- **utils/**: Utility/helper functions.
- **config/**: Environment or client-specific overrides.
- **theme/**: Light/dark theme definitions and styling hooks.

---

### Key Source Files

- **App.js**: Entry point of the React Native app.
- **constants.js**: Global constants used throughout the app.
- **i18n.js**: Sets up localization using translation files.
- **babel.config.js**: Babel setup for transpiling the app.
- **eas.json**: Expo build setup for EAS services.
- **app.json**: Core app configuration for Expo.
- **package.json**: Project metadata and dependencies.
- **package-lock.json**: Locked versions of npm packages.
- **.gitignore**: Files/folders excluded from Git versioning.

---


## Contributing

We welcome contributions to help improve the IBE Mobile Application! Here's how you can get involved:

### How to Contribute

1. **Fork the repository**:
   Start by forking the repository to your GitHub account:

   ```bash
   git clone https://github.com/ibedotnet/ibe-mobile.git
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

### Contribution Guidelines

Before contributing, please review our [Coding Standards](./docs/coding-standards.md) to ensure consistency across the codebase.
For details on how we manage branches and releases, see the [Deployment Guidelines](./docs/deployment-guidelines.md).

- **Style Guide**: Follow established conventions and write clean, readable code.
- **Testing**: Thoroughly test your changes and include unit or integration tests where applicable.
- **Documentation**: Update or add documentation for any new features or changes.
- **Branch Naming**: Use descriptive branch names like `feature/add-login` or `bugfix/fix-timesheet-total`.

### Reporting Issues

If you encounter any issues or bugs, feel free to [open an issue](https://github.com/ibedotnet/ibe-mobile/issues) on the repository. When reporting, please be sure to include:

- A clear title and description.
- Steps to reproduce the issue.
- Any relevant log files or screenshots.
-

## Security

If you discover a security vulnerability in this project, please report it responsibly by contacting the maintainers at [security@ibe.net](mailto:security@ibe.net).  
Do not open public issues for security-related concerns.

## License

This project is licensed under the MIT License. See the [LICENSE](https://opensource.org/licenses/MIT) file for details.
