import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, publicFolderAPI } from '../api/client';
function LoginPage() {
    const [email, setEmail] = useState('shubnit12@gmail.com')
    const [password, setPassword] = useState('MyPassword123')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [show2FA, setShow2FA] = useState(false);
    const [twoFAToken, setTwoFAToken] = useState('');

    const [publicFolders, setPublicFolders] = useState<any[]>([]);

    const navigate = useNavigate()

    useEffect(() => {
        publicFolderAPI.getAll()
            .then((data) => setPublicFolders(data.folders || []))
            .catch(() => {});
    }, []);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true)
        setError('');
        console.log('Login attempt', { email, password })
        try {
            if (show2FA) {
                const response = await authAPI.verify2FA(email, twoFAToken);

                // Save tokens
                localStorage.setItem('accessToken', response.accessToken);
                localStorage.setItem('refreshToken', response.refreshToken);
                localStorage.setItem('user', JSON.stringify(response.user));
                console.log('2FA verification successful', response.user);
                navigate('/dashboard')
            }
            else {
                const response = await authAPI.login(email, password);

                if ('requires2FA' in response) {
                    console.log('2FA is required')
                    setShow2FA(true);
                } else {
                    localStorage.setItem('accessToken', response.accessToken);
                    localStorage.setItem('refreshToken', response.refreshToken);
                    localStorage.setItem('user', JSON.stringify(response.user)); 
                    console.log('Login successfull', response.user)
                    navigate('/dashboard')

                }
            }


        } catch (error: any) {
            const message = error.response?.data?.error || 'Login failed';
            setError(message);
            console.error('Login failed:', error);
        } finally {
            setLoading(false);
        }
    }
    const handleReset = () => {
    setEmail('');
        setPassword('');
        setTwoFAToken('');
        setShow2FA(false);
        setError('');
    };
    return (
        <div>
            <h1>Login</h1>

            {publicFolders.length > 0 && (
                <div>
                    <h2>Public Folders</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
                        {publicFolders.map((folder: any) => (
                            <div
                                key={folder.id}
                                onClick={() => window.open(`/p/${folder.public_slug}`, '_blank')}
                                style={{
                                    border: '1px solid #ccc',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    minWidth: '140px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: '#f9f9f9'
                                }}
                            >
                                <span style={{ fontSize: '28px' }}>🌐</span>
                                <span style={{ fontSize: '14px', fontWeight: 500, textAlign: 'center' }}>{folder.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {error && <p style={{ color: 'red' }}>{error}</p>}

            <form onSubmit={handleSubmit}>
                <input
                    type="email"
                    placeholder='Email'
                    value={email}
                    disabled={show2FA} 
                    onChange={(e) => setEmail(e.target.value)}>
                </input>


                <input
                    type="password"
                    placeholder='Password'
                    value={password}
                    disabled={show2FA} 
                    onChange={(e) => setPassword(e.target.value)}>
                </input>

                {show2FA && (
                    <input
                        type="text"
                        placeholder="2FA Token (6 digits)"
                        value={twoFAToken}
                        onChange={(e) => setTwoFAToken(e.target.value)}
                        maxLength={6}
                    />
                )}

                <button type="submit" disabled={loading}>{loading ? 'Loading...' : 'Login'}</button>

                {show2FA && (
                    <button
                        type="button"
                        onClick={handleReset}
                        className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                    >
                        Reset / Change Email
                    </button>
                )}
            </form>

        </div>
    )
}

export default LoginPage;