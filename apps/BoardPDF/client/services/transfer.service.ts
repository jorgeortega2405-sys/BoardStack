let transferredFile: File | null = null;

function consumeTransferFile(): File | null {
  const file = transferredFile;
  transferredFile = null;
  return file;
}

function getTransferFile(): File | null {
  return transferredFile;
}

function setTransferFile(file: File | null): void {
  transferredFile = file;
}

export { consumeTransferFile, getTransferFile, setTransferFile };
