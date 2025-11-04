exports.handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2));

    // Example quiz question response structure
    const response = {
        statusCode: 200,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message: "Hello from quizfunction Lambda!",
            inputEvent: event
        })
    };
    
    return response;
};
