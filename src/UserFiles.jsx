import React, { useState, useEffect } from 'react';
import { Storage } from '@aws-amplify/storage';

function UserFiles() {
  const [files, setFiles] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    if (!uploadFile) return;
    try {
      await Storage.put(uploadFile.name, uploadFile);
      loadFiles();
    } catch (err) {
      setError('Failed to upload file');
    }
  };

  const loadFiles = async () => {
    try {
      const result = await Storage.list('');
      setFiles(result);
    } catch (err) {
      setError('Failed to load files');
    }
  };

  const handleDownload = async (key) => {
    try {
      const url = await Storage.get(key);
      window.open(url);
    } catch (err) {
      setError('Failed to get download URL');
    }
  };

  const handleGenerateQuiz = async (fileKey) => {
    setLoading(true);
    setError(null);
    setQuizQuestions([]);

    try {
      const requestBody = {
        fileKey,
        task: 'generateQuiz'
      };
      const response = await fetch('https://bnksajuxeg.execute-api.us-east-1.amazonaws.com/default/EduCloud-Summarizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();

      if (data.body) {
        const body = JSON.parse(data.body);
        if (body.success && body.questions) {
          setQuizQuestions(body.questions);
        } else {
          setError(body.error || 'Failed to generate quiz');
        }
      } else {
        setError('Invalid response format');
      }
    } catch (err) {
      setError('Error calling API: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  return (
    <div className="container">
      <header className="navbar">
        <h1>Quiz & File Manager</h1>
      </header>

      <main>
        <h2>My Files</h2>
        <div style={{ marginBottom: '20px' }}>
          <input type="file" onChange={e => setUploadFile(e.target.files[0])} />
          <button onClick={handleUpload} style={{ marginLeft: '10px' }}>Upload</button>
        </div>
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
        {loading && <p>Generating quiz...</p>}
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        {quizQuestions.length > 0 && (
          <div style={{ marginTop: '30px' }}>
            <h3>Quiz Questions</h3>
            {quizQuestions.map((q, idx) => (
              <div key={q.id || idx} className="quiz-question">
                <p><strong>Question {q.id || (idx + 1)}:</strong> {q.question}</p>
                {q.options && q.options.length > 0 && (
                  <ul>
                    {q.options.map((opt, i) => (
                      <li key={i}>{opt}</li>
                    ))}
                  </ul>
                )}
                {q.answer && <p><strong>Answer:</strong> {q.answer}</p>}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default UserFiles;
