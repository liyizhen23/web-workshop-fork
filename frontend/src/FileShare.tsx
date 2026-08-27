import { useEffect, useState } from "react";
import { Button, List, message, Popconfirm, Spin, Upload } from "antd";
import type { UploadProps } from "antd";
import {
  DeleteOutlined,
  InboxOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import axios from "axios";
import * as graphql from "./graphql";
import { Card, Container, Scroll, Text } from "./Components";

const { Dragger } = Upload;

interface FileShareProps {
  room: graphql.GetJoinedRoomsQuery["user_room"][0]["room"] | undefined;
  handleClose: () => void;
}

const fetchFileList = async (roomUUID: string) => {
  try {
    const response = await axios.get("/file/list?room=" + roomUUID);
    return response.data.fileList;
  } catch (error) {
    console.error(error);
    message.error("获取文件列表失败！");
    return [];
  }
};

const downloadFile = async (roomUUID: string, filename: string) => {
  try {
    message.info("正在请求下载...");
    const response = await axios.get(
      "/file/download?room=" + roomUUID + "&filename=" + filename
    );
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    message.success("开始下载文件！");
  } catch (error) {
    console.error(error);
    message.error("下载文件失败！");
  }
};

const FileShare: React.FC<FileShareProps> = ({ room, handleClose }) => {
  const [fileList, setFileList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (room) {
      fetchFileList(room.uuid).then(setFileList);
    }
  }, [room]);

  const uploadFile = async (file: File, onSuccess: any, onError: any) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await axios.post("/file/upload/" + room?.uuid, formData);
      await fetchFileList(room?.uuid).then(setFileList);
      message.success("上传文件成功！");
      onSuccess?.();
    } catch (error) {
      console.error(error);
      message.error("上传文件失败！");
      onError?.(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (room) {
      fetchFileList(room.uuid).then(setFileList);
    }
    setTimeout(() => setRefreshing(false), 1000);
  };

  const deleteFile = async (filename: string) => {
    try {
      await axios.post("/file/delete", {
        room: room?.uuid,
        filename,
      });
      setFileList((current) => current.filter((file) => file !== filename));
      message.success("删除文件成功！");
    } catch (error) {
      console.error(error);
      message.error("删除文件失败，请刷新列表后重试！");
    }
  };

  const Refresh = () => (
    <Button
      type="link"
      style={{
        width: "40px",
        height: "40px",
        fontSize: "16px",
        position: "absolute",
        left: 0,
        top: 0,
      }}
      className="need-interaction"
      onClick={handleRefresh}
    >
      <ReloadOutlined spin={refreshing} />
    </Button>
  );

  const Close = () => (
    <Button
      type="link"
      style={{
        width: "40px",
        height: "40px",
        fontSize: "12px",
        position: "absolute",
        right: 0,
        top: 0,
      }}
      className="need-interaction"
      onClick={handleClose}
    >
      ❌
    </Button>
  );

  if (!room) {
    return null;
  }
  return (
    <Card style={{ width: "300px", height: "500px" }}>
      <Refresh />
      <Close />
      <Container style={{ margin: "6px" }}>
        <Text>
          <strong>{room.name}</strong>
        </Text>
        <Text size="small" style={{ marginTop: "6px", marginBottom: "6px" }}>
          文件共享空间
        </Text>
      </Container>
      <FileList
        roomUUID={room.uuid}
        filelist={fileList}
        onDelete={deleteFile}
      />
      <div
        className="need-interaction"
        style={{ marginTop: "12px", width: "100%" }}
      >
        <Dragger
          customRequest={({
            file,
            onSuccess,
            onError,
          }: Parameters<NonNullable<UploadProps["customRequest"]>>[0]) => {
            uploadFile(file as File, onSuccess, onError);
          }}
          showUploadList={false}
          disabled={loading}
        >
          <p className="ant-upload-drag-icon">
            {loading ? <Spin size="large" /> : <InboxOutlined />}
          </p>
          <p className="ant-upload-text">拖拽或点击上传文件</p>
        </Dragger>
      </div>
    </Card>
  );
};

interface FileListProps {
  roomUUID: string;
  filelist: string[];
  onDelete: (filename: string) => Promise<void>;
}

const FileList: React.FC<FileListProps> = ({ roomUUID, filelist, onDelete }) => {
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const handleDelete = async (filename: string) => {
    setDeletingFile(filename);
    try {
      await onDelete(filename);
    } finally {
      setDeletingFile(null);
    }
  };

  const Download = (filename: string) => (
    <Button
      key={`download-${filename}`}
      type="link"
      style={{ fontSize: "18px", width: "18px", height: "18px", padding: 0 }}
      onClick={async () => await downloadFile(roomUUID, filename)}
      aria-label={`下载 ${filename}`}
    >
      <DownloadOutlined />
    </Button>
  );

  const Delete = (filename: string) => (
    <Popconfirm
      key={`delete-${filename}`}
      title="确定删除这个文件吗？"
      description={filename}
      okText="删除"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      onConfirm={() => handleDelete(filename)}
    >
      <Button
        type="link"
        danger
        loading={deletingFile === filename}
        disabled={deletingFile !== null && deletingFile !== filename}
        style={{ fontSize: "18px", width: "18px", height: "18px", padding: 0 }}
        aria-label={`删除 ${filename}`}
      >
        <DeleteOutlined />
      </Button>
    </Popconfirm>
  );

  return (
    <Scroll>
      <List
        size="small"
        dataSource={filelist}
        renderItem={(filename) => (
          <List.Item
            style={{ padding: "8px" }}
            actions={[Download(filename), Delete(filename)]}
          >
            <Text style={{ wordBreak: "break-all" }}>{filename}</Text>
          </List.Item>
        )}
      />
    </Scroll>
  );
};

export default FileShare;
