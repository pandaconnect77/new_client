import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { motion } from "framer-motion";
import axios from "axios";

/*
  Replace SERVER with your deployed signaling server URL (http://localhost:4000 for dev)
*/
const SERVER = "https://new-a5px.onrender.com";
const STUN_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export default function CallPage() {
  const [userId, setUserId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [status, setStatus] = useState("idle"); // idle, calling, incoming, in-call, ringing
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [availableOutputs, setAvailableOutputs] = useState([]);
  const [selectedOutputId, setSelectedOutputId] = useState("");
  const [ringFrom, setRingFrom] = useState(null);

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Audio level analyzers
  const localAnalyserRef = useRef(null);
  const remoteAnalyserRef = useRef(null);
  const [localLevel, setLocalLevel] = useState(0);
  const [remoteLevel, setRemoteLevel] = useState(0);

  // initialize socket once
  useEffect(() => {
    socketRef.current = io(SERVER);
    const s = socketRef.current;

    s.on("connect", () => console.log("socket connected", s.id));
    s.on("registered", () => console.log("registered ack"));

    s.on("incoming-call", async ({ from, offer }) => {
      console.log("incoming from", from);
      setTargetId(from);
      setStatus("incoming");
      setRingFrom(from);
      // show UI for incoming; let user click accept
      // but we won't auto-accept here; the Accept button triggers acceptCall()
      // store remote offer temporarily
      socketRef.current._incomingOffer = offer;
      socketRef.current._incomingFrom = from;
    });

    s.on("call-accepted", async ({ from, answer }) => {
      if (!pcRef.current) {
        console.warn("No pc to set remote description on caller");
        return;
      }
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        startCallTimer();
        setStatus("in-call");
      } catch (err) {
        console.error("call-accepted error", err);
      }
    });

    s.on("ice-candidate", async ({ candidate }) => {
      if (!pcRef.current || !candidate) return;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("Failed to add ICE candidate", err);
      }
    });

    s.on("user-offline", ({ to }) => {
      alert(`${to} is offline`);
      cleanupCall(false);
    });

    s.on("call-ended", ({ from }) => {
      console.log("call-ended by", from);
      cleanupCall(true);
    });

    // enumerate output devices for speaker toggle
    navigator.mediaDevices?.enumerateDevices?.().then((devices) => {
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      setAvailableOutputs(outputs);
      if (outputs.length) setSelectedOutputId(outputs[0].deviceId);
    });

    return () => {
      s.disconnect();
      stopMetering();
      cleanupCall(false);
    };
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // register function
  function register() {
    if (!userId) return alert("Enter a userId to register");
    socketRef.current.emit("register", userId);
    alert("Registered as " + userId);
  }

  // create peer connection helper
  function createPeerConnection(remoteLabel = "") {
    const pc = new RTCPeerConnection(STUN_SERVERS);

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        socketRef.current.emit("ice-candidate", { to: targetId, candidate: ev.candidate });
      }
    };

    pc.ontrack = (ev) => {
      console.log("ontrack", ev.streams);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = ev.streams[0];
        // ensure audio plays (user gesture should have occurred)
        remoteAudioRef.current.play().catch((e) => {
          console.warn("play blocked", e);
        });
        // attach remote to analyser
        attachRemoteAnalyser(ev.streams[0]);
      }
    };

    // optional: monitor connection state
    pc.onconnectionstatechange = () => {
      console.log("pc state", pc.connectionState);
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        cleanupCall(true);
      }
    };

    return pc;
  }

  async function setupLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // attach to local analyser for meter
      attachLocalAnalyser(stream);

      return stream;
    } catch (err) {
      alert("Microphone access denied or not available");
      throw err;
    }
  }

  async function callUser() {
    if (!targetId) return alert("Enter target ID");
    if (!userId) return alert("Register first");
    setStatus("calling");

    await setupLocalStream();

    pcRef.current = createPeerConnection("caller");

    // add local tracks
    localStreamRef.current.getTracks().forEach((t) => pcRef.current.addTrack(t, localStreamRef.current));

    // create offer
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);

    socketRef.current.emit("call-user", {
      to: targetId,
      from: userId,
      offer: pcRef.current.localDescription,
    });

    // set a timeout for ringing if desired
    timerIntervalRef.current = null;
  }

  async function acceptCall() {
    if (!socketRef.current._incomingOffer) return;
    await setupLocalStream();

    pcRef.current = createPeerConnection("callee");

    // add local tracks
    localStreamRef.current.getTracks().forEach((t) => pcRef.current.addTrack(t, localStreamRef.current));

    // set remote desc using the stored offer (the server may have sent it earlier)
    const offer = socketRef.current._incomingOffer;
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pcRef.current.createAnswer();
    await pcRef.current.setLocalDescription(answer);

    socketRef.current.emit("accept-call", {
      to: socketRef.current._incomingFrom, // the original caller id
      from: userId,
      answer: pcRef.current.localDescription,
    });

    setStatus("in-call");
    startCallTimer();

    // cleanup stored incoming
    socketRef.current._incomingOffer = null;
    socketRef.current._incomingFrom = null;
    setRingFrom(null);
  }

  function rejectCall() {
    // simply clear incoming
    setStatus("idle");
    socketRef.current._incomingOffer = null;
    socketRef.current._incomingFrom = null;
    setRingFrom(null);
  }

  function endCall() {
    if (targetId && userId) {
      socketRef.current.emit("end-call", { to: targetId, from: userId });
    }
    cleanupCall(true);
  }

  async function cleanupCall(save = false) {
    try {
      stopMetering();

      if (pcRef.current) {
        pcRef.current.getSenders().forEach((s) => {
          if (s.track) s.track.stop();
        });
        try {
          pcRef.current.close();
        } catch (e) {}
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
        const durationSec = Math.round((endTime - startTimeRef.current) / 1000);
        // Optionally save to server
        axios.post(`${SERVER}/api/calls`, {
          callerId: userId,
          receiverId: targetId,
          startTime: startTimeRef.current,
          endTime,
          duration: durationSec,
          status: "completed",
        }).catch((e) => console.warn("save failed", e));
      }
    } finally {
      setStatus("idle");
      startTimeRef.current = null;
      stopCallTimer();
      setCallDuration(0);
      setTargetId("");
      setIsMuted(false);
    }
  }

  function startCallTimer() {
    startTimeRef.current = new Date();
    setCallDuration(0);
    timerIntervalRef.current = setInterval(() => {
      setCallDuration(Math.floor((new Date() - startTimeRef.current) / 1000));
    }, 1000);
  }
  function stopCallTimer() {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }

  function stopMetering() {
    if (localAnalyserRef.current) {
      try { localAnalyserRef.current.disconnect(); } catch {}
      localAnalyserRef.current = null;
    }
    if (remoteAnalyserRef.current) {
      try { remoteAnalyserRef.current.disconnect(); } catch {}
      remoteAnalyserRef.current = null;
    }
  }

  // Attach analysers for audio level meters
  function attachLocalAnalyser(stream) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      localAnalyserRef.current = { analyser, audioCtx };
      meterLoopLocal();
    } catch (e) {
      console.warn("local analyser not available", e);
    }
  }
  function attachRemoteAnalyser(stream) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      remoteAnalyserRef.current = { analyser, audioCtx };
      meterLoopRemote();
    } catch (e) {
      console.warn("remote analyser not available", e);
    }
  }

  function meterLoopLocal() {
    if (!localAnalyserRef.current) return;
    const arr = new Uint8Array(localAnalyserRef.current.analyser.frequencyBinCount);
    localAnalyserRef.current.analyser.getByteFrequencyData(arr);
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    setLocalLevel(Math.min(100, Math.round((avg / 255) * 100)));
    requestAnimationFrame(meterLoopLocal);
  }
  function meterLoopRemote() {
    if (!remoteAnalyserRef.current) return;
    const arr = new Uint8Array(remoteAnalyserRef.current.analyser.frequencyBinCount);
    remoteAnalyserRef.current.analyser.getByteFrequencyData(arr);
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    setRemoteLevel(Math.min(100, Math.round((avg / 255) * 100)));
    requestAnimationFrame(meterLoopRemote);
  }

  // mute/unmute local mic
  function toggleMute() {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMuted((v) => !v);
  }

  // speaker toggle: set audio element sinkId if supported
  async function setSpeakerOutput(deviceId) {
    if (!remoteAudioRef.current) return;
    if (!("setSinkId" in HTMLMediaElement.prototype)) {
      // fallback: we can mute/unmute to emulate speaker off
      console.warn("setSinkId not supported");
      return;
    }
    try {
      await remoteAudioRef.current.setSinkId(deviceId);
      setSelectedOutputId(deviceId);
    } catch (err) {
      console.warn("setSinkId error", err);
    }
  }

  // handle toggling speaker (if setSinkId supported)
  async function toggleSpeaker() {
    if (!("setSinkId" in HTMLMediaElement.prototype)) {
      // fallback: just toggle volume
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = !remoteAudioRef.current.muted;
        setIsSpeakerOn(!remoteAudioRef.current.muted);
      }
      return;
    }
    // try to find first non-default device if turning on
    if (!isSpeakerOn && availableOutputs.length > 0) {
      const out = availableOutputs[availableOutputs.length - 1];
      await setSpeakerOutput(out.deviceId);
      setIsSpeakerOn(true);
    } else {
      // set to default or mute
      if (availableOutputs.length > 0) {
        await setSpeakerOutput(availableOutputs[0].deviceId);
      }
      setIsSpeakerOn(false);
    }
  }

  // Helper to format time
  function fmtTime(s) {
    const mm = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }

  // UI
  return (
    <>
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 px-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full max-w-md"
      >
        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-indigo-600 mb-6">
          Panda Audio
        </h2>

        {/* User ID */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your User ID
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="unique e.g. alice"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm sm:text-base"
            />
            <button
              onClick={register}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 w-full sm:w-auto"
            >
              Register
            </button>
          </div>
        </div>

        {/* Target ID */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target User ID
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="e.g. bob"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm sm:text-base"
            />
            <button
              onClick={callUser}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 w-full sm:w-auto"
            >
              Call
            </button>
            <button
              onClick={endCall}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 w-full sm:w-auto"
            >
              End
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="mb-4 text-center">
          <span className="text-gray-600">Status: </span>
          <span className="font-semibold text-indigo-500">{status}</span>
          {status === "in-call" && (
            <span className="ml-2 text-sm text-gray-500">
              ({fmtTime(callDuration)})
            </span>
          )}
        </div>

        {/* Incoming call */}
        {status === "incoming" && (
          <div className="mb-4">
            <div className="text-center mb-2">
              Incoming call from <strong>{ringFrom}</strong>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={acceptCall}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Accept
              </button>
              <button
                onClick={rejectCall}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {/* Call Controls */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mb-4">
          <button
            onClick={toggleMute}
            className={`flex-1 px-3 py-2 rounded-lg text-sm sm:text-base ${
              isMuted ? "bg-yellow-400 text-white" : "bg-gray-200"
            }`}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>

          <button
            onClick={toggleSpeaker}
            className={`flex-1 px-3 py-2 rounded-lg text-sm sm:text-base ${
              isSpeakerOn ? "bg-blue-400 text-white" : "bg-gray-200"
            }`}
          >
            {isSpeakerOn ? "Speaker On" : "Speaker Off"}
          </button>

          <select
            className="flex-1 px-2 py-2 border rounded-lg text-sm sm:text-base"
            value={selectedOutputId}
            onChange={async (e) => {
              const id = e.target.value;
              setSelectedOutputId(id);
              await setSpeakerOutput(id);
            }}
          >
            {availableOutputs.length === 0 && <option>No outputs</option>}
            {availableOutputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || d.deviceId}
              </option>
            ))}
          </select>
        </div>

        {/* Audio Levels */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <div className="text-xs text-gray-500 mb-1">Mic level</div>
            <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
              <div
                style={{ width: `${localLevel}%`, height: "100%" }}
                className="bg-green-500"
              ></div>
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <div className="text-xs text-gray-500 mb-1">Speaker level</div>
            <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
              <div
                style={{ width: `${remoteLevel}%`, height: "100%" }}
                className="bg-blue-500"
              ></div>
            </div>
          </div>
        </div>

        {/* Hidden Audio Element */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        <p className="text-xs text-center text-gray-400 mt-2">
          Both users must be online & registered.
        </p>
      </motion.div>
    </div>
    </>
  );
}
