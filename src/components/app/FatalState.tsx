type FatalStateProps = {
  message: string;
};

export function FatalState({ message }: FatalStateProps) {
  return (
    <main className="loading-shell error">
      <h2>资料库不可用</h2>
      <p>{message}</p>
    </main>
  );
}
