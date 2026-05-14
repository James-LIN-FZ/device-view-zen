export type DeviceStatus = "online" | "offline" | "streaming";

export interface Device {
  id: string;
  name: string;
  model: string;
  status: DeviceStatus;
  location: string;
  encoding: {
    videoSource: string;
    videoCodec: string;
    audioCodec: string;
    bitrate: string;
    framerate: string;
    resolution: string;
    streamUrl: string;
  };
  nics: { name: string; type: string }[];
}

export const devices: Device[] = [
  {
    id: "DEV-001",
    name: "演播室主机 A",
    model: "VTX-Pro 4K",
    status: "streaming",
    location: "1号演播厅",
    encoding: {
      videoSource: "SDI-1 (4K60)",
      videoCodec: "H.265 / HEVC",
      audioCodec: "AAC-LC 48kHz",
      bitrate: "12 Mbps",
      framerate: "60 fps",
      resolution: "3840 × 2160",
      streamUrl: "rtmp://push.live.cdn/studio/main_a",
    },
    nics: [
      { name: "eth0", type: "1GbE 主用" },
      { name: "eth1", type: "1GbE 备用" },
      { name: "wlan0", type: "Wi-Fi 6" },
      { name: "4G-A", type: "运营商 A" },
      { name: "4G-B", type: "运营商 B" },
      { name: "5G-C", type: "运营商 C" },
    ],
  },
  {
    id: "DEV-002",
    name: "外场背包 01",
    model: "VTX-Bonded",
    status: "streaming",
    location: "上海外滩",
    encoding: {
      videoSource: "HDMI-1 (1080p)",
      videoCodec: "H.264 / AVC",
      audioCodec: "AAC-LC 48kHz",
      bitrate: "6 Mbps",
      framerate: "50 fps",
      resolution: "1920 × 1080",
      streamUrl: "srt://push.live.cdn:9000?streamid=field01",
    },
    nics: [
      { name: "eth0", type: "1GbE" },
      { name: "wlan0", type: "Wi-Fi 5" },
      { name: "4G-A", type: "中国移动" },
      { name: "4G-B", type: "中国联通" },
      { name: "4G-C", type: "中国电信" },
      { name: "5G-D", type: "5G SA" },
    ],
  },
  {
    id: "DEV-003",
    name: "会议室编码器",
    model: "VTX-Mini",
    status: "online",
    location: "总部 12F",
    encoding: {
      videoSource: "HDMI-1 (1080p)",
      videoCodec: "H.264 / AVC",
      audioCodec: "AAC-LC 48kHz",
      bitrate: "4 Mbps",
      framerate: "30 fps",
      resolution: "1920 × 1080",
      streamUrl: "rtmp://push.live.cdn/meeting/room12",
    },
    nics: [
      { name: "eth0", type: "1GbE" },
      { name: "eth1", type: "1GbE" },
      { name: "wlan0", type: "Wi-Fi 6" },
      { name: "4G-A", type: "备用蜂窝" },
      { name: "VPN0", type: "IPSec" },
      { name: "VPN1", type: "WireGuard" },
    ],
  },
  {
    id: "DEV-004",
    name: "户外直播车",
    model: "VTX-Mobile",
    status: "streaming",
    location: "杭州西湖",
    encoding: {
      videoSource: "SDI-2 (1080p)",
      videoCodec: "H.265 / HEVC",
      audioCodec: "AAC-LC 48kHz",
      bitrate: "10 Mbps",
      framerate: "50 fps",
      resolution: "1920 × 1080",
      streamUrl: "srt://push.live.cdn:9000?streamid=mobile01",
    },
    nics: [
      { name: "eth0", type: "千兆主链路" },
      { name: "wlan0", type: "Wi-Fi 6" },
      { name: "4G-A", type: "移动" },
      { name: "4G-B", type: "联通" },
      { name: "5G-C", type: "电信 5G" },
      { name: "SAT", type: "卫星链路" },
    ],
  },
  {
    id: "DEV-005",
    name: "备用编码器 B",
    model: "VTX-Pro",
    status: "online",
    location: "机房",
    encoding: {
      videoSource: "SDI-1",
      videoCodec: "H.264 / AVC",
      audioCodec: "AAC-LC 48kHz",
      bitrate: "8 Mbps",
      framerate: "30 fps",
      resolution: "1920 × 1080",
      streamUrl: "rtmp://push.live.cdn/backup/b",
    },
    nics: [
      { name: "eth0", type: "1GbE" },
      { name: "eth1", type: "1GbE" },
      { name: "eth2", type: "10GbE" },
      { name: "wlan0", type: "Wi-Fi 6" },
      { name: "4G-A", type: "蜂窝" },
      { name: "VPN0", type: "IPSec" },
    ],
  },
  {
    id: "DEV-006",
    name: "演播室主机 B",
    model: "VTX-Pro 4K",
    status: "offline",
    location: "2号演播厅",
    encoding: {
      videoSource: "—",
      videoCodec: "—",
      audioCodec: "—",
      bitrate: "—",
      framerate: "—",
      resolution: "—",
      streamUrl: "—",
    },
    nics: [
      { name: "eth0", type: "1GbE" },
      { name: "eth1", type: "1GbE" },
      { name: "wlan0", type: "Wi-Fi 6" },
      { name: "4G-A", type: "蜂窝" },
      { name: "4G-B", type: "蜂窝" },
      { name: "5G-C", type: "5G" },
    ],
  },
];
