import { useState, useEffect } from 'react';
import { Authenticator, Button, Heading, Flex, View, Card, Text, Alert } from '@aws-amplify/ui-react';
import { StorageManager } from '@aws-amplify/ui-react-storage';
import { list, remove } from 'aws-amplify/storage';
import { post } from 'aws-amplify/api';
import '@aws-amplify/ui-react/styles.css';
import { fetchAuthSession } from 'aws-amplify/auth';

const formFields = {
  signUp: {
    email: { order: 1, isRequired: true },
    password: { order: 2 },
    confirm_password: { order: 3 },
  },
};

const acceptedFileTypes = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];

const apiName = 'EduCloud-Summarizer-API';

function App() {
  // Quiz State
  const [quizFiles, setQuizFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  // Summarizer State
  const [summaryFile, setSummaryFile] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);

  // My Files Section
  const [userFiles, setUserFiles] = useState([]);
  const [isLoadingUserFiles, setIsLoadingUserFiles] = useState(false);

  // List quiz files
  async function fetchQuizFiles() {
    setIsLoadingFiles(true);
    try {
      const result = await list({
        path: "protected/us-east-1:32a73466-df15-c79d-91ee-35fa9511c268/quizzes",
        options: { listAll: true }
      });
      console.log('Quiz files from S3:', result);
      const actualFiles = result.items.filter(item =>
        item.size !== undefined &&
        item.size > 0 &&
        item.path &&
        !item.path.endsWith('/'));
      const formattedFiles = actualFiles.map(file => ({
        key: file.path,
        lastModified: file.lastModified?.toLocaleString() || 'N/A',
      }));
      console.log('Formatted quiz files:', formattedFiles);
      setQuizFiles(formattedFiles);
    } catch (error) {
      console.error('Error fetching quiz files:', error);
      setQuizFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  }

  // List user (normal) files
  async function fetchUserFiles() {
    setIsLoadingUserFiles(true);
    try {
      const result = await list({
        path: ({ identityId }) => `protected/${identityId}/myfiles/`,
        options: { listAll: true }
      });
      const actualFiles = result.items.filter(item =>
        item.size !== undefined &&
        item.size > 0 &&
        item.path &&
        !item.path.endsWith('/'));
      const formattedFiles = actualFiles.map(file => ({
        key: file.path,
        lastModified: file.lastModified?.toLocaleString() || 'N/A',
      }));
      setUserFiles(formattedFiles);
    } catch (error) {
      console.error('Error fetching user files:', error);
      setUserFiles([]);
    } finally {
      setIsLoadingUserFiles(false);
    }
  }

  useEffect(() => {
    async function checkAuthState() {
      try {
        await fetchAuthSession({ forceRefresh: false });
        setIsAuthenticated(true);
        fetchQuizFiles();
        fetchUserFiles();
      } catch (e) {
        setIsAuthenticated(false);
        setQuizFiles([]);
        setUserFiles([]);
      }
    }
    checkAuthState();
  }, []);

  // QUIZ - Call Lambda to get quiz
  async function generateSimpleQuiz(fileKey) {
    setIsGeneratingQuiz(true);
    console.log('=== GENERATING QUIZ ===');
    console.log('File key:', fileKey);
    
    try {
      const requestBody = { fileKey, task: 'generateQuiz' };
      console.log('Request body:', requestBody);
      
      const restOperation = post({
        apiName,
        path: '/EduCloud-Summarizer',
        options: { body: requestBody }
      });
      
      console.log('Waiting for response...');
      const response = await restOperation.response;
      console.log('Response received:', response);
      
      const data = await response.body.json();
      console.log('Parsed data:', data);
      
      // Check if response has 'body' property (Lambda wraps response)
      let actualData = data;
      if (data.body && typeof data.body === 'string') {
        console.log('Lambda wrapped response detected, parsing body...');
        actualData = JSON.parse(data.body);
      }
      
      console.log('Actual data:', actualData);
      console.log('actualData.success:', actualData.success);
      console.log('actualData.questions:', actualData.questions);
      console.log('actualData.error:', actualData.error);

      
      if (actualData.success && actualData.questions) {
        console.log('SUCCESS - Quiz questions received:', actualData.questions);
        const fileName = fileKey.split('/').pop().replace(/\.(pptx?|pdf)$/i, '');
        setCurrentQuiz({ title: fileName, questions: actualData.questions, fileKey });
        setUserAnswers({});
        setShowResults(false);
      } else {
        console.log('FAILED - Quiz generation failed. Data:', actualData);
        alert('Failed to generate quiz. Error: ' + (actualData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('ERROR in generateSimpleQuiz:', error);
      console.error('Error details:', error.message);
      alert('Error generating quiz. Check console for details.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  }

  // QUIZ - Delete file from S3 (after completion)
  async function deleteQuizFile(fileKey) {
    try {
      await remove({ path: fileKey });
      fetchQuizFiles();
    } catch (error) {
      console.error('Error deleting quiz file:', error);
    }
  }

  function handleAnswerSelect(questionId, optionIndex) {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  }

  function calculateScore() {
    if (!currentQuiz) return 0;
    let correct = 0;
    currentQuiz.questions.forEach(q => {
      if (userAnswers[q.id] === q.correctAnswer) {
        correct++;
      }
    });
    return correct;
  }

  function submitQuiz() {
    if (Object.keys(userAnswers).length < currentQuiz.questions.length) {
      alert('Please answer all questions before submitting!');
      return;
    }
    setShowResults(true);
  }

  function resetQuiz() {
    if (showResults && currentQuiz && currentQuiz.fileKey) {
      deleteQuizFile(currentQuiz.fileKey);
    }
    setCurrentQuiz(null);
    setUserAnswers({});
    setShowResults(false);
  }

  // After upload success - refresh quiz file list
  function onUploadSuccess({ key }) {
    console.log('Quiz file uploaded:', key);
    setTimeout(() => { fetchQuizFiles(); }, 500);
  }

  // After upload success - refresh my normal files
  function onNormalUploadSuccess({ key }) {
    console.log('Normal file uploaded:', key);
    setTimeout(() => { fetchUserFiles(); }, 500);
  }

  // SIGN OUT
  const handleSignOut = async (signOutProvidedByAuthenticator) => {
    try {
      await signOutProvidedByAuthenticator();
      setIsAuthenticated(false);
      setQuizFiles([]);
      setUserFiles([]);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // ===== SUMMARIZER FUNCTION =====
  async function handleSummarize(fileKey) {
    setIsSummarizing(true);
    setSummaryText('');
    console.log('Summarizing file:', fileKey);
    try {
      const restOperation = post({
        apiName,
        path: '/EduCloud-Summarizer',
        options: { body: { fileKey, task: 'summarize' } }
      });
      const response = await restOperation.response;
      const data = await response.body.json();
      console.log('Summary response:', data);
      
      // Handle wrapped response
      let actualData = data;
      if (data.body && typeof data.body === 'string') {
        actualData = JSON.parse(data.body);
      }
      
      if (actualData.success && actualData.summary) setSummaryText(actualData.summary);
      else setSummaryText('No summary returned.');
    } catch (error) {
      console.error('Summary error:', error);
      setSummaryText('Summary failed.');
    } finally {
      setIsSummarizing(false);
    }
  }

  // Render Quiz UI
  if (currentQuiz) {
    const score = calculateScore();
    const totalQuestions = currentQuiz.questions.length;
    return (
      <Authenticator formFields={formFields} loginMechanisms={['email']}>
        {({ signOut, user }) => (
          <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <Flex justifyContent="space-between" alignItems="center">
              <Heading level={2}>Quiz: {currentQuiz.title}</Heading>
              <Button onClick={resetQuiz} variation="link">← Back to Dashboard</Button>
            </Flex>
            <hr style={{ margin: '20px 0' }} />
            {!showResults ? (
              <>
                {currentQuiz.questions.map((q, qIndex) => (
                  <Card key={q.id} variation="outlined" margin="1rem 0" padding="1.5rem">
                    <Heading level={4}>Question {qIndex + 1}</Heading>
                    <Text fontSize="1.1rem" marginBottom="1rem">{q.question}</Text>
                    {q.options.map((option, optIndex) => (
                      <View key={optIndex} marginBottom="0.5rem">
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            checked={userAnswers[q.id] === optIndex}
                            onChange={() => handleAnswerSelect(q.id, optIndex)}
                            style={{ marginRight: '10px', cursor: 'pointer' }}
                          />
                          <Text>{option}</Text>
                        </label>
                      </View>
                    ))}
                  </Card>
                ))}
                <Button onClick={submitQuiz} variation="primary" width="100%" marginTop="2rem">
                  Submit Quiz
                </Button>
              </>
            ) : (
              <>
                <Alert variation="success" heading={`Your Score: ${score} / ${totalQuestions}`} marginBottom="2rem">
                  {score === totalQuestions ? 'Perfect score! Excellent work! 🎉' :
                   score >= totalQuestions * 0.7 ? 'Great job! You did well! 👏' :
                   'Keep practicing, you can do better! 💪'}
                </Alert>
                {currentQuiz.questions.map((q, qIndex) => {
                  const isCorrect = userAnswers[q.id] === q.correctAnswer;
                  return (
                    <Card 
                      key={q.id} 
                      variation="outlined" 
                      margin="1rem 0" 
                      padding="1.5rem"
                      style={{ 
                        borderColor: isCorrect ? '#28a745' : '#dc3545',
                        borderWidth: '2px'
                      }}
                    >
                      <Flex justifyContent="space-between" alignItems="center">
                        <Heading level={4}>Question {qIndex + 1}</Heading>
                        <Text 
                          fontSize="1.2rem" 
                          fontWeight="bold"
                          color={isCorrect ? '#28a745' : '#dc3545'}
                        >
                          {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                        </Text>
                      </Flex>
                      <Text fontSize="1.1rem" marginBottom="1rem">{q.question}</Text>
                      {q.options.map((option, optIndex) => {
                        const isUserAnswer = userAnswers[q.id] === optIndex;
                        const isCorrectAnswer = q.correctAnswer === optIndex;
                        return (
                          <View 
                            key={optIndex} 
                            padding="0.5rem"
                            marginBottom="0.5rem"
                            backgroundColor={
                              isCorrectAnswer ? 'rgba(40, 167, 69, 0.1)' :
                              isUserAnswer ? 'rgba(220, 53, 69, 0.1)' :
                              'transparent'
                            }
                            borderRadius="4px"
                          >
                            <Text>
                              {isCorrectAnswer && '✓ '}
                              {isUserAnswer && !isCorrectAnswer && '✗ '}
                              {option}
                            </Text>
                          </View>
                        );
                      })}
                    </Card>
                  );
                })}
                <Button onClick={resetQuiz} variation="primary" width="100%" marginTop="2rem">
                  Back to Dashboard
                </Button>
              </>
            )}
          </main>
        )}
      </Authenticator>
    );
  }

  // Render Dashboard (Default)
  return (
    <Authenticator formFields={formFields} loginMechanisms={['email']}>
      {({ signOut, user }) => (
        <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
          <Flex justifyContent="space-between" alignItems="center">
            <Heading level={2}>Hello, {user?.attributes?.email || user?.username}</Heading>
            <Button onClick={() => handleSignOut(signOut)} variation="primary">Sign Out</Button>
          </Flex>
          <hr style={{ margin: '20px 0' }} />
          <Flex direction={{ base: 'column', large: 'row' }} justifyContent="space-around" gap="2rem">
            {/* Summarizer Section */}
            <View flex="1" padding="1rem" border="1px solid #ccc" borderRadius="6px">
              <Heading level={3} style={{ marginBottom: '20px' }}>📄 Document Summarizer</Heading>
              <StorageManager
                acceptedFileTypes={acceptedFileTypes}
                path="summaries/"
                maxFileCount={1}
                isResumable
                autoUpload={true}
                onUploadSuccess={({ key }) => setSummaryFile(key)}
              />
              {summaryFile && (
                <Button onClick={() => handleSummarize(summaryFile)} isLoading={isSummarizing} marginTop="1rem">
                  Summarize
                </Button>
              )}
              {summaryText && (
                <Card variation="outlined" marginTop="1rem">
                  <Heading level={4}>Summary</Heading>
                  <Text whiteSpace="pre-line">{summaryText}</Text>
                </Card>
              )}
            </View>
            {/* Quiz Generator Section */}
            <View flex="1" padding="1rem" border="1px solid #ccc" borderRadius="6px">
              <Heading level={3} style={{ marginBottom: '20px' }}>🧠 Quiz Generator</Heading>
              <StorageManager
                acceptedFileTypes={acceptedFileTypes}
                path="quizzes/"
                maxFileCount={1}
                isResumable
                autoUpload={true}
                onUploadSuccess={onUploadSuccess}
              />
              <View marginTop="2rem">
                <Heading level={4}>Your Uploaded Quiz Documents</Heading>
                {isLoadingFiles ? (
                  <Text>Loading files...</Text>
                ) : quizFiles.length === 0 ? (
                  <Text>Upload a document using the Quiz Generator above.</Text>
                ) : (
                  quizFiles.map(file => (
                    <Card key={file.key} variation="outlined" margin="1rem 0">
                      <Flex justifyContent="space-between" alignItems="center">
                        <Text>{file.key.split('/').pop()}</Text>
                        <Button 
                          variation="primary" 
                          onClick={() => generateSimpleQuiz(file.key)}
                          isLoading={isGeneratingQuiz}
                        >
                          Take Quiz
                        </Button>
                      </Flex>
                    </Card>
                  ))
                )}
              </View>
            </View>
            {/* My Files Section */}
            <View flex="1" padding="1rem" border="1px solid #ccc" borderRadius="6px">
              <Heading level={3} style={{ marginBottom: '20px' }}>🗂️ My Files</Heading>
              <StorageManager
                path={({ identityId }) => `protected/${identityId}/myfiles/`}
                maxFileCount={10}
                isResumable
                autoUpload={true}
                onUploadSuccess={onNormalUploadSuccess}
                showUploadList={true}
              />
              <View marginTop="2rem">
                <Heading level={4}>Your Uploaded Files</Heading>
                {isLoadingUserFiles ? (
                  <Text>Loading files...</Text>
                ) : userFiles.length === 0 ? (
                  <Text>No files uploaded yet.</Text>
                ) : (
                  userFiles.map(file => (
                    <Card key={file.key} variation="outlined" margin="1rem 0">
                      <Flex justifyContent="space-between" alignItems="center">
                        <Text>{file.key.split('/').pop()}</Text>
                        <Button 
                          as="a"
                          href={`https://educloudfrontend2bf38c8bc5dc4051a5746eb0aace1a63c289-cleanenv.s3.amazonaws.com/${file.key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          variation="link"
                        >
                          View
                        </Button>
                      </Flex>
                      <Text fontSize="0.9rem" marginTop="0.5rem">Last Modified: {file.lastModified}</Text>
                    </Card>
                  ))
                )}
              </View>
            </View>
          </Flex>
        </main>
      )}
    </Authenticator>
  );
}

export default App;
