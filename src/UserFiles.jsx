import React, { useState, useEffect } from 'react';
import { Storage } from '@aws-amplify/storage';

function UserFiles() {
  const [files, setFiles] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Handle file upload
  const handleUpload = async () => {
    if (!uploadFile) return;
    await Storage.put(uploadFile.name, uploadFile);
    loadFiles();
  };

  // List files in S3
  const loadFiles = async () => {
    const result = await Storage.list('');
    console.log('Files loaded from S3:', result);
    setFiles(result);
  };

  // Download file
  const handleDownload = async (key) => {
    const url = await Storage.get(key);
    window.open(url);
  };

  // Generate Quiz from uploaded file
  const handleGenerateQuiz = async (fileKey) => {
    setLoading(true);
    setError(null);
    setQuizQuestions([]);

    console.log('=== DEBUG: Generating Quiz ===');
    console.log('File key received:', fileKey);

    try {
      const requestBody = {
        fileKey: fileKey,
        task: 'generateQuiz'
      };
      
      console.log('Request body:', JSON.stringify(requestBody));

      const response = await fetch('https://bnksajuxeg.execute-api.us-east-1.amazonaws.com/default/EduCloud-Summarizer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('API Response:', data);
      
      if (data.body) {
        const body = JSON.parse(data.body);
        console.log('Parsed body:', body);
        
        if (body.success && body.questions) {
          setQuizQuestions(body.questions);
          console.log('Quiz questions set successfully:', body.questions.length, 'questions');
        } else {
          console.log('Error from API:', body.error);
          setError(body.error || 'Failed to generate quiz');
        }
      } else {
        console.log('No body in response');
        setError('Invalid response format');
      }
    } catch (err) {
      console.error('Catch block error:', err);
      setError('Error calling API: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>My Files</h2>
      
      {/* File Upload Section */}
      <div style={{ marginBottom: '20px' }}>
        <input type="file" onChange={e => setUploadFile(e.target.files[0])} />
        <button onClick={handleUpload}>Upload</button>
      </div>

      {/* Files List */}
      <h3>Uploaded Files</h3>
      <ul>
        {files.map(file => (
          <li key={file.key} style={{ marginBottom: '10px' }}>
            {file.key} 
            <button onClick={() => handleDownload(file.key)} style={{ marginLeft: '10px' }}>View</button>
            <button onClick={() => handleGenerateQuiz(file.key)} style={{ marginLeft: '10px' }}>Generate Quiz</button>
          </li>
        ))}
      </ul>

      {/* Loading State */}
      {loading && <p>Generating quiz...</p>}

      {/* Error Display */}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {/* Quiz Questions Display */}
      {quizQuestions.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <h3>Quiz Questions</h3>
          {quizQuestions.map((q, index) => (
            <div key={q.id || index} style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
              <p><strong>Question {q.id}:</strong> {q.question}</p>
              <p><strong>Answer:</strong> {q.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UserFiles;
