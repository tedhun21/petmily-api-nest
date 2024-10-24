import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';
import { UsersService } from 'src/users/users.service';
import { SendEmailInput } from './dto/send-email.mail.dto';
import { Repository } from 'typeorm';
import { Verification } from 'src/users/entity/verification.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class MailService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
  ) {}

  // 이메일 보내는 함수
  async sendVerificationEmail(email: string, code: string) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: 'Petmily Verificaiton Code',
      text: 'Please type this code in Petmily',
      html: `<strong>${code}</strong>`,
    };

    try {
      const response = await sgMail.send(msg);
      console.log('SendGrid response:', response);
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Fail to send email');
    }
  }

  async generateAndSaveVerificationCode(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new NotFoundException('No user found');
    }

    let verification = await this.verificationRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!verification) {
      // Create new verification entry (code will be auto-generated)
      verification = this.verificationRepository.create({ user });
    }

    try {
      // Save or update the verification code
      await this.verificationRepository.save(verification);
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Failed to save verification code',
      );
    }
  }

  async sendEmailWithCode(sendEmailInput: SendEmailInput) {
    const { email } = sendEmailInput;

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      // code 이메일 보내기
      await this.sendVerificationEmail(email, code);

      // code 저장
      await this.generateAndSaveVerificationCode(email);

      return { message: 'Sucessfully send mail with code' };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Fail to send email with code');
    }
  }
}
