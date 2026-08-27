export interface INotifier {
  send(recipient: string, templateCode: string, data: Record<string, any>): Promise<void>;
}
