import { useState, useEffect } from 'react';
import { fileAPI } from '../api/client';

interface FileThumbnailProps {
    fileId: string;
    mimeType: string;
    size?: number;
    fill?: boolean;
}

function FileThumbnail({ fileId, mimeType, size = 60, fill = false }: FileThumbnailProps) {
    const [thumbUrl, setThumbUrl] = useState<string | null>(null);

    const isSupported = mimeType.startsWith('image/') || mimeType.startsWith('video/');

    useEffect(() => {
        if (!isSupported) return;

        let objectUrl: string;

        fileAPI.getThumbnail(fileId)
            .then((blob) => {
                objectUrl = URL.createObjectURL(blob);
                setThumbUrl(objectUrl);
            })
            .catch(() => {
                // No thumbnail available yet or not supported
            });

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [fileId]);

    if (thumbUrl) {
        if (fill) {
            return <img src={thumbUrl} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />;
        }
        return <img src={thumbUrl} alt="thumbnail" width={size} height={size} style={{ objectFit: 'cover', borderRadius: '4px', verticalAlign: 'middle', marginRight: '6px' }} />;
    }

    if (fill) {
        return <span style={{ fontSize: '2.5rem' }}>📄</span>;
    }
    return <span style={{ marginRight: '6px' }}>📄</span>;
}

export default FileThumbnail;
