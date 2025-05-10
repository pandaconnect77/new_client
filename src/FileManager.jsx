import React, { useEffect, useState } from 'react';
import axios from 'axios';

const FileManager = () => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const fetchFiles = async () => {
  try {
    const res = await axios.get('http://localhost:5000/files');
    setFiles(Array.isArray(res.data) ? res.data : []);
  } catch (err) {
    console.error('Error fetching files:', err);
    setFiles([]); // fallback
  }
};


  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await axios.post('http://localhost:5000/upload', formData);
      setSelectedFile(null);
      fetchFiles();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (filename) => {
    window.open(`http://localhost:5000/files/${filename}`, '_blank');
  };

  const handleDelete = async (filename) => {
    try {
      await axios.delete(`http://localhost:5000/files/${filename}`);
      fetchFiles();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h2 className="text-xl font-bold mb-4">File Manager</h2>

      <div className="mb-4">
        <input type="file" onChange={handleFileChange} />
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="ml-2 px-4 py-1 bg-blue-600 text-white rounded"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>

      <ul className="space-y-2">
        {files.map((file) => (
          <li key={file._id} className="flex justify-between items-center bg-gray-100 px-4 py-2 rounded">
            <span>{file.filename}</span>
            <div>
              <button
                onClick={() => handleDownload(file.filename)}
                className="px-2 py-1 mr-2 bg-green-500 text-white rounded"
              >
                Download
              </button>
              <button
                onClick={() => handleDelete(file.filename)}
                className="px-2 py-1 bg-red-500 text-white rounded"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FileManager;
