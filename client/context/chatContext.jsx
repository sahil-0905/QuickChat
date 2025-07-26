import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({});
  const { socket, axios } = useContext(AuthContext);

  // Fetch users for sidebar
  const getUsers = useCallback(async () => {
    if (!axios) return;
    try {
      const { data } = await axios.get("/api/messages/user");
      if (data.success) {
        setUsers(data.users);
        setUnseenMessages(data.unseenMessages);
      }
    } catch (error) {
      toast.error(error.message);
    }
  }, [axios]);

  // Fetch messages for selected user
  const getMessages = useCallback(
    async (userId) => {
      if (!axios || !userId) return;
      try {
        const { data } = await axios.get(`/api/messages/${userId}`);
        if (data.success) {
          setMessages(data.messages);
        }
      } catch (error) {
        toast.error(error.message);
      }
    },
    [axios]
  );

  // Send a message to selected user
  const sendMessage = useCallback(
    async (messageData) => {
      if (!axios || !selectedUser?._id) return;
      try {
        const { data } = await axios.post(`/api/messages/send/${selectedUser._id}`, messageData);
        if (data.success) {
          setMessages((prevMessages) => [...prevMessages, data.newMessage]);
        } else {
          toast.error(data.message);
        }
      } catch (error) {
        toast.error(error.message);
      }
    },
    [axios, selectedUser]
  );

  // Subscribe to new messages coming via socket
  const subscribeToMessage = useCallback(() => {
    if (!socket) return;

    socket.off("newMessage"); // cleanup previous listeners

    socket.on("newMessage", async (newMessage) => {
      if (selectedUser && newMessage.senderId === selectedUser._id) {
        newMessage.seen = true;
        setMessages((prevMessages) => [...prevMessages, newMessage]);
        try {
          await axios.put(`/api/messages/mark/${newMessage._id}`);
        } catch (error) {
          toast.error("Failed to mark message as seen");
        }
      } else {
        setUnseenMessages((prevUnseenMessages) => ({
          ...prevUnseenMessages,
          [newMessage.senderId]: (prevUnseenMessages[newMessage.senderId] || 0) + 1,
        }));
      }
    });
  }, [socket, selectedUser, axios]);

  // Unsubscribe from socket events
  const unsubscribeFromMessages = useCallback(() => {
    if (socket) socket.off("newMessage");
  }, [socket]);

  // Effect to subscribe/unsubscribe socket listeners when socket or selectedUser changes
  useEffect(() => {
    subscribeToMessage();
    return () => unsubscribeFromMessages();
  }, [subscribeToMessage, unsubscribeFromMessages]);

  const value = {
    messages,
    users,
    setUsers,
    selectedUser,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
    getUsers,
    getMessages,
    sendMessage,
    socket,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
