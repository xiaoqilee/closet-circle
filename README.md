# 👚 Closet Circle 👕
### A fun and sustainable alternative to fast fashion, Closet Circle is the website for all of your clothing borrowing, exchanging, and discovery needs!

---
## Project Setup


This is a full-stack project with a **Next.js** client, a **Node.js/Express** server, and a Rasa chatbot.



### Prerequisites

Make sure you have the following installed on your machine:

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js) or [yarn](https://yarnpkg.com/)
- A Python virtual environment (conda, pyenv, etc) on version 3.10 
---

## Getting Started

### 1. Clone the Repository
```bash
git clone <repository-url>
cd closet-circle
```
### 2. Install dependencies
**Navigate to the ```client``` directory and install dependencies**
```bash
cd client
npm install
```
#### **Installing python dependencies**

Navigate to the ```root``` directory, start the python virtual environment, and install the following dependencies
```
conda activate <your_env_name> 
```
> You can also start a python virtual environment using ```source venv/bin/activate``` 
```
pip install rasa rasa-sdk thefuzz
```

> - **rasa** and **rasa-sdk** are libraries for the rasa chatbot 
> - **thefuzz** is used for fuzzy comparisions between strings in the chatbot's internal logic. 
  
**Navigate to the ```server``` directory and install dependencies**
```bash
cd ../server
npm install
```
### 3. Running the Development Environment
**Start the Client**
In the ```client``` directory
```bash
npm run dev
```
This will start the Next.js development server. Open [http://localhost:3000](http://localhost:3000) in your browser to view the client.

**Start the Server**
In the ```server``` directory
```bash
npm start
```
This will start the Node.js/Express server. By default, it will run on [http://localhost:8800](http://localhost:8800).

### 4. Running the Rasa Chatbot 
Navigate to the ``rasa``  directory 
```
cd ../rasa
```
If this is your first time running the application, train the rasa model: 
```
rasa train
```
Start the **actions server** by running
```
rasa run actions
```

Start the **rasa server** by running: 
```
rasa run --enable-api --cors "*"
```

