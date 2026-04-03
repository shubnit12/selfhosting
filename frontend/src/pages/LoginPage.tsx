import './LoginPage.css';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, publicFolderAPI } from '../api/client';
function LoginPage() {
    const [email, setEmail] = useState('sidhumoosa5911@legend.com')
    const [password, setPassword] = useState('Sidhu@5911')
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
            navigator.vibrate?.(200);
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
        <div className="login-page">
            <div className="link-to-my-websites-section">
                <div className="link-to-my-websites-cards-grid">
                    <span>
                        <button className="my-websites-links"
                            onClick={() => { navigator.vibrate?.(50); window.open(`https://www.shubnit.com`, '_blank'); }}>
                            My Portfolio 💼
                        </button>
                    </span>
                    <span>
                        <button className="my-websites-links"
                            onClick={() => { navigator.vibrate?.(50); window.open(`https://blog.shubnit.com`, '_blank'); }}>
                            My Blog 📝
                        </button>
                    </span>
                </div>
            </div>
            {publicFolders.length > 0 && (
                <div className="public-folders-section">
                    <h2>Public Folders</h2>
                    <div className="folder-cards-grid">
                        {publicFolders.map((folder: any) => (
                            <div
                            key={folder.id}
                            onClick={() => {navigator.vibrate?.(50); window.open(`/p/${folder.public_slug}`, '_blank');}}
                            className="folder-card"
                            >
                                {/* <span>🌐</span> */}
                                <span>{folder.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
             <hr className="login-divider" />
            {error && <p className="login-error">{error}</p>}
            <div className="login-card">

                <h1>Login</h1>
                <form onSubmit={handleSubmit}>
                    <input
                        type="email"
                        placeholder='Email'
                        value={email}
                        disabled={show2FA} 
                        onChange={(e) => setEmail(e.target.value)}
                        className="login-input">
                            
                    </input>


                    <input
                        type="password"
                        placeholder='Password'
                        value={password}
                        disabled={show2FA} 
                        onChange={(e) => setPassword(e.target.value)}
                        className="login-input">
                    </input>

                    {show2FA && (
                        <input
                        type="text"
                        placeholder="2FA Token (6 digits)"
                        value={twoFAToken}
                        onChange={(e) => setTwoFAToken(e.target.value)}
                        maxLength={6}
                        className="login-input"
                        />
                    )}

                    <button type="submit" disabled={loading} className="login-btn" onClick={() => { navigator.vibrate?.(50); }}
                    >{loading ? 'Loading...' : 'Login'}</button>

                    {show2FA && (
                        <button
                        type="button"
                        onClick={() => { navigator.vibrate?.(50); handleReset();}}
                        className="login-btn-secondary"
                        
                        >
                            Reset / Change Email
                        </button>
                    )}
                </form>

            </div>
        </div>
    )
}

export default LoginPage;
