import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import axios from "axios";
import { motion } from "framer-motion"; // ✅ import motion for animations

const SERVER = "https://new-a5px.onrender.com";
const STUN_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export default function CallPage() {
  const [userId, setUserId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [status, setStatus] = useState("idle");
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SERVER);
    const s = socketRef.current;

    s.on("connect", () => console.log("socket connected", s.id));

    s.on("incoming-call", async ({ from, offer }) => {
      setStatus("incoming");
      setTargetId(from);
      const accept = window.confirm(`Incoming call from ${from}. Accept?`);
      if (!accept) {
        setStatus("idle");
        return;
      }
      await setupLocalStream();

      pcRef.current = new RTCPeerConnection(STUN_SERVERS);
      pcRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          s.emit("ice-candidate", { to: from, candidate: event.candidate });
        }
      };
      pcRef.current.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      };

      localStreamRef.current
        .getTracks()
        .forEach((track) =>
          pcRef.current.addTrack(track, localStreamRef.current)
        );

      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);

      s.emit("accept-call", {
        to: from,
        from: userId,
        answer: pcRef.current.localDescription,
      });

      setStatus("in-call");
      startTimeRef.current = new Date();
    });

    s.on("call-accepted", async ({ from, answer }) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
      setStatus("in-call");
      startTimeRef.current = new Date();
    });

    s.on("ice-candidate", async ({ candidate }) => {
      try {
        if (pcRef.current && candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.warn("Failed to add ICE candidate", err);
      }
    });

    s.on("user-offline", ({ to }) => {
      alert(`${to} is offline`);
      cleanupCall();
    });

    s.on("call-ended", ({ from }) => {
      cleanupCall(true);
    });

    return () => {
      s.disconnect();
    };
  }, [userId]);

  async function register() {
    if (!userId) return alert("Enter userId");
    socketRef.current.emit("register", userId);
    alert("Registered as " + userId);
  }

  async function setupLocalStream() {
    if (localStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
    } catch (err) {
      alert("Microphone access denied or not available");
      throw err;
    }
  }

  async function callUser() {
    if (!targetId) return alert("Enter target ID");
    await setupLocalStream();

    pcRef.current = new RTCPeerConnection(STUN_SERVERS);
    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", {
          to: targetId,
          candidate: event.candidate,
        });
      }
    };
    pcRef.current.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    localStreamRef.current
      .getTracks()
      .forEach((track) =>
        pcRef.current.addTrack(track, localStreamRef.current)
      );

    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);

    socketRef.current.emit("call-user", {
      to: targetId,
      from: userId,
      offer: pcRef.current.localDescription,
    });
    setStatus("calling");
  }

  function endCall(manual = true) {
    if (targetId) {
      socketRef.current.emit("end-call", { to: targetId, from: userId });
    }
    cleanupCall(manual);
  }

  async function cleanupCall(save = true) {
    try {
      if (pcRef.current) {
        pcRef.current.getSenders().forEach((s) => {
          if (s.track) s.track.stop();
        });
        pcRef.current.close();
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }

      if (save && startTimeRef.current) {
        const endTime = new Date();
        const durationSec = Math.round(
          (endTime - startTimeRef.current) / 1000
        );
        try {
          await axios.post(`${SERVER}/api/calls`, {
            callerId: userId,
            receiverId: targetId,
            startTime: startTimeRef.current,
            endTime,
            duration: durationSec,
            status: "completed",
          });
        } catch (err) {
          console.warn("Failed to save call history", err);
        }
      }
    } finally {
      setStatus("idle");
      startTimeRef.current = null;
      setTargetId("");
    }
  }

  return (
   <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 px-4">
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6 }}
    className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full max-w-md"
  >
    <h2 className="text-xl sm:text-2xl font-bold text-center text-indigo-600 mb-6">
    Panda Audio
    </h2>

    {/* User ID Section */}
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Your User ID
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="e.g. f"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
        />
        <button
          onClick={register}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition w-full sm:w-auto"
        >
          Register
        </button>
      </div>
    </div>

    {/* Target ID Section */}
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Target User ID
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder="e.g. m"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
        />
        <button
          onClick={callUser}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition w-full sm:w-auto"
        >
          Call
        </button>
        <button
          onClick={endCall}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition w-full sm:w-auto"
        >
          End
        </button>
      </div>
    </div>

    {/* Status */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      key={status}
      className="mb-6 text-center"
    >
      <span className="text-gray-600 font-medium">
        Status:{" "}
        <span className="font-semibold text-indigo-500">{status}</span>
      </span>
    </motion.div>

    {/* Remote Audio */}
    <audio ref={remoteAudioRef} autoPlay />

    {/* Footer Note */}
    <p className="text-xs sm:text-sm text-gray-400 text-center mt-4 leading-relaxed">
      Both users must be online and registered for the call to work.
    </p>
  </motion.div>
</div>
  );
}
