import express from 'express';
import { runAutomation } from './automation.js';

const app = express();

app.get('/', (req, res) => {
    res.send('Hello, World!');
}
);

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
    runAutomation().then(() => {
        console.log('Automation script executed successfully.');
    }
    ).catch((error) => {
        console.error('Error executing automation script:', error);
    }
    );
}
);