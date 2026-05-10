// Import the built-in 'http' module
const http = require('http');

// Define the port number where the server will listen
const PORT = 3000;

// Create the server instance
const server = http.createServer((req, res) => {
    // req = Request (information about the incoming call)
    // res = Response (what we send back to the user)

    // Set the response header (Status 200 means 'OK', Content-Type tells the browser it's text/html)
    res.writeHead(200, { 'Content-Type': 'text/html' });

    // Check the URL path to serve different content
    if (req.url === '/') {
        res.write('<h1>Welcome to the Home Page!</h1>');
        res.write('<p>This is a basic Node.js server.</p>');
    } else if (req.url === '/about') {
        res.write('<h1>About Us</h1>');
        res.write('<p>This server was created using the built-in HTTP module.</p>');
    } else {
        // Handle 404 - Not Found
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.write('<h1>404 Error</h1>');
        res.write('<p>The page you are looking for does not exist.</p>');
    }

    // End the response
    res.end();
});

// Start the server and listen on the specified port
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}/`);
    console.log('Press Ctrl+C to stop the server.');
});
